using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace VoiceChatService.Hubs
{
    public class SignalingHub : Hub
    {
        // Oda eşlemeleri: RoomId -> List of ConnectionIds
        private static readonly ConcurrentDictionary<string, ConcurrentBag<string>> Rooms = new();
        
        // Kullanıcı eşlemeleri: ConnectionId -> RoomId
        private static readonly ConcurrentDictionary<string, string> UserRooms = new();
        private readonly ILogger<SignalingHub> _logger;

        public SignalingHub(ILogger<SignalingHub> logger)
        {
            _logger = logger;
        }

        public async Task JoinRoom(string roomId)
        {
            string connectionId = Context.ConnectionId;
            _logger.LogInformation("Kullanıcı bağlandı: {ConnectionId}, Oda: {RoomId}", connectionId, roomId);
            
            // Eğer kullanıcı zaten başka bir odadaysa önce oradan çıkar
            await LeaveCurrentRoom();

            // Yeni odaya ekle
            var roomUsers = Rooms.GetOrAdd(roomId, _ => new ConcurrentBag<string>());
            if (!roomUsers.Contains(connectionId))
            {
                roomUsers.Add(connectionId);
            }
            UserRooms[connectionId] = roomId;

            // SignalR Grubu'na ekle
            await Groups.AddToGroupAsync(connectionId, roomId);

            // Odadaki diğer kullanıcılara yeni birinin katıldığını bildir
            await Clients.OthersInGroup(roomId).SendAsync("UserJoined", connectionId);

            // Yeni katılan kullanıcıya odadaki mevcut kullanıcıların listesini gönder (kendi hariç)
            var otherUsers = roomUsers.Where(id => id != connectionId).ToList();
            await Clients.Caller.SendAsync("RoomUsers", otherUsers);
        }

        public async Task SendSignal(string targetConnectionId, string signal)
        {
            _logger.LogInformation("Sinyal iletiliyor: {Sender} -> {Target}", Context.ConnectionId, targetConnectionId);
            // WebRTC Offer, Answer veya ICE Candidate paketini doğrudan hedefe iletir
            await Clients.Client(targetConnectionId).SendAsync("ReceiveSignal", Context.ConnectionId, signal);
        }

        public async Task Ping()
        {
            await Clients.Caller.SendAsync("Pong");
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await LeaveCurrentRoom();
            await base.OnDisconnectedAsync(exception);
        }

        private async Task LeaveCurrentRoom()
        {
            string connectionId = Context.ConnectionId;
            _logger.LogInformation("Kullanıcı ayrıldı: {ConnectionId}", connectionId);
            if (UserRooms.TryRemove(connectionId, out var roomId))
            {
                // Odadan kullanıcının connectionId'sini temizle
                if (Rooms.TryGetValue(roomId, out var roomUsers))
                {
                    var updatedUsers = new ConcurrentBag<string>(roomUsers.Where(id => id != connectionId));
                    Rooms.TryUpdate(roomId, updatedUsers, roomUsers);
                    
                    if (updatedUsers.IsEmpty)
                    {
                        Rooms.TryRemove(roomId, out _);
                    }
                }

                // Odadaki diğer kullanıcılara ayrıldığını bildir
                await Clients.OthersInGroup(roomId).SendAsync("UserLeft", connectionId);
                await Groups.RemoveFromGroupAsync(connectionId, roomId);
            }
        }
    }
}
