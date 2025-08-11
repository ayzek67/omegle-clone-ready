const socket = io({ path: "/socket.io" });
console.log("Socket connected:", socket.id);