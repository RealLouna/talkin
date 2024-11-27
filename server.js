const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const localtunnel = require('localtunnel');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const upload = multer({ dest: 'uploads/' });

const messagesFile = 'messages.json';
const usersFile = 'users.json';

// Lire les messages à partir du fichier
function readMessages() {
    if (fs.existsSync(messagesFile)) {
        return JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
    } else {
        return [];
    }
}

// Sauvegarder les messages dans le fichier
function saveMessages(messages) {
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
}

// Lire les utilisateurs à partir du fichier
function readUsers() {
    if (fs.existsSync(usersFile)) {
        return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    } else {
        return { admin: { password: 'adminpassword', role: 'admin' } };  // Ajouter un compte admin par défaut
    }
}

// Sauvegarder les utilisateurs dans le fichier
function saveUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

let messages = readMessages();
let users = readUsers();
let rooms = ["General"]; // Créer une liste de salons par défaut

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload', upload.single('image'), (req, res) => {
    const file = req.file;
    if (file) {
        res.json({ success: true, url: `/uploads/${file.filename}` });
    } else {
        res.json({ success: false });
    }
});

// Fonction pour créer dynamiquement un fichier HTML pour un nouveau salon
function createRoomFile(roomName) {
    const fileName = `${roomName}.html`;
    const template = fs.readFileSync(path.join(__dirname, 'public', 'chat.html'), 'utf8');
    fs.writeFileSync(path.join(__dirname, 'public', fileName), template.replace(/currentRoom = "General";/g, `currentRoom = "${roomName}";`));
}

io.on('connection', (socket) => {
    socket.emit('loadMessages', messages);
    socket.emit('loadRooms', rooms);  // Envoyer la liste des salons au client

    socket.on('register', (username, password) => {
        if (users.hasOwnProperty(username)) {
            socket.emit('registrationFailed', 'Nom d\'utilisateur déjà utilisé');
        } else {
            users[username] = { password: password, role: 'user' };
            saveUsers(users);
            socket.emit('registrationSuccess');
        }
    });

    socket.on('login', (username, password) => {
        if (!users.hasOwnProperty(username)) {
            socket.emit('loginFailed', 'Nom d\'utilisateur non trouvé');
        } else if (users[username].password !== password) {
            socket.emit('loginFailed', 'Mot de passe incorrect');
        } else {
            socket.emit('loginSuccess', { username: username, profileEmoji: users[username].profileEmoji });
        }
    });

    socket.on('sendMessage', (message) => {
        messages.push(message);
        saveMessages(messages);
        io.to(message.room).emit('receiveMessage', message);
    });

    socket.on('sendPrivateMessage', (message) => {
        const recipientSocket = [...io.sockets.sockets.values()].find(s => s.username === message.to);
        if (recipientSocket) {
            recipientSocket.emit('receivePrivateMessage', message);
        }
    });

    socket.on('sendImage', (message) => {
        messages.push(message);
        saveMessages(messages);
        io.to(message.room).emit('receiveImage', message);
    });

    socket.on('sendGif', (message) => {
        messages.push(message);
        saveMessages(messages);
        io.to(message.room).emit('receiveGif', message);
    });

    socket.on('changeProfilePicture', (data) => {
        if (users[data.user]) {
            users[data.user].profileEmoji = data.profileEmoji;
            saveUsers(users);
            io.emit('userProfileChanged', { user: data.user, profileEmoji: data.profileEmoji });
        }
    });

    socket.on('createRoom', (roomName, callback) => {
        if (rooms.includes(roomName)) {
            callback(false); // Le salon existe déjà
        } else {
            rooms.push(roomName);
            createRoomFile(roomName);
            io.emit('roomCreated', roomName);
            callback(true); // Salon créé avec succès
        }
    });

    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
    });

    socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, async () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);

    try {
        const tunnel = await localtunnel({ port: Number(PORT), subdomain: 'talkinchat' });
        console.log(`Tunnel accessible à : ${tunnel.url}`);
    } catch (err) {
        console.error('Erreur lors de la création du tunnel:', err);
    }
});
