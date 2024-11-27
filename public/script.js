const apiKey = 'YOUR_API_KEY_GIPHY';
let messages = [];
let isDarkMode = false;
let guestCounter = 1;
let currentUser = {};

// Fonction pour afficher l'écran d'inscription
function showRegister() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('register').style.display = 'block';
}

// Fonction pour afficher l'écran de connexion
function showLogin() {
  document.getElementById('register').style.display = 'none';
  document.getElementById('login').style.display = 'block';
}

// Fonction d'inscription
function register() {
  const usernameInput = document.getElementById('register-username');
  const passwordInput = document.getElementById('register-password');
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (username === '' || password === '') {
    alert('Veuillez entrer un nom d\'utilisateur et un mot de passe');
    return;
  }

  socket.emit('register', username, password);
}

socket.on('registrationFailed', (message) => {
  alert(message);
});

socket.on('registrationSuccess', () => {
  alert('Inscription réussie ! Veuillez vous connecter.');
  showLogin();
});

// Fonction de connexion
function login() {
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  socket.emit('login', username, password);
}

socket.on('loginFailed', (message) => {
  alert(message);
});

socket.on('loginSuccess', (user) => {
  currentUser = user;
  document.getElementById('username').value = user.username;
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  if (user.role === 'admin') {
    document.getElementById('admin-controls').style.display = 'block';
  }
  socket.emit('userConnected', user.username);
});

// Fonction de connexion en tant qu'invité
function loginAsGuest() {
  const username = `Guest${guestCounter++}`;
  currentUser = { username: username, role: 'guest' };
  document.getElementById('username').value = username;
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  socket.emit('userConnected', username);
}

const socket = io('https://talkin.loca.lt/');

socket.on('loadMessages', (loadedMessages) => {
  messages = loadedMessages;
  displayMessages();
});

function sendMessage() {
  const username = document.getElementById('username').value;
  const color = document.getElementById('color').value;
  const emoji = document.getElementById('emoji').value;
  const messageInput = document.getElementById('message-input');
  const messageText = messageInput.value;

  // Vérifier les mots interdits
  const bannedWords = ['mot_interdit1', 'mot_interdit2'];  // Liste noire des mots interdits
  for (let word of bannedWords) {
    if (messageText.includes(word)) {
      alert(`Le mot "${word}" est interdit.`);
      return;
    }
  }

  socket.emit('sendMessage', { username, text: messageText, color, emoji });
  messageInput.value = '';
}

socket.on('receiveMessage', (message) => {
  messages.push(message);
  displayMessages();
});

function displayMessages() {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML = '';
  messages.forEach((message, index) => {
    const newMessageDiv = document.createElement('div');
    if (message.image) {
      newMessageDiv.innerHTML = '<p><strong style="color: ' + message.color + ';">' + message.username + ' ' + message.emoji + '</strong>: <img src="' + message.image + '" alt="' + message.description + '" style="max-width: 100%; height: auto;"> ' + message.description + '</p>';
    } else if (message.gif) {
      newMessageDiv.innerHTML = '<p><strong style="color: ' + message.color + ';">' + message.username + ' ' + message.emoji + '</strong>: <img src="' + message.gif + '" alt="' + message.description + '" style="max-width: 100%; height: auto;"> ' + message.description + '</p>';
    } else {
      newMessageDiv.innerHTML = '<p><strong style="color: ' + message.color + ';">' + message.username + ' ' + message.emoji + '</strong>: ' + message.text + '</p>';
    }
    if (currentUser.role === 'admin') {
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Supprimer';
      deleteButton.onclick = () => deleteMessage(index);
      newMessageDiv.appendChild(deleteButton);
    }
    messagesDiv.appendChild(newMessageDiv);
  });
}

setInterval(function() {
  displayMessages();
}, 1000);

function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('dark-mode', isDarkMode);
}

function uploadImage() {
  const imageInput = document.getElementById('image-input');
  imageInput.click();
  imageInput.onchange = function() {
    const file = imageInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      const username = document.getElementById('username').value;
      const color = document.getElementById('color').value;
      const emoji = document.getElementById('emoji').value;
      const imageData = e.target.result;
      const description = document.getElementById('image-description').value;
      socket.emit('sendImage', { username: username, color: color, emoji: emoji, image: imageData, description: description });
    };
    reader.readAsDataURL(file);
  };
}

socket.on('receiveImage', (message) => {
  messages.push(message);
  displayMessages();
});

function uploadGIF() {
  const gifInput = document.getElementById('gif-input');
  gifInput.click();
  gifInput.onchange = function() {
    const file = gifInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      const username = document.getElementById('username').value;
      const color = document.getElementById('color').value;
      const emoji = document.getElementById('emoji').value;
      const gifData = e.target.result;
      const description = document.getElementById('gif-description').value;
      socket.emit('sendGIF', { username: username, color: color, emoji: emoji, gif: gifData, description: description });
    };
    reader.readAsDataURL(file);
  };
}

socket.on('receiveGIF', (message) => {
  messages.push(message);
  displayMessages();
});

function searchGIF() {
  const searchTerm = document.getElementById('gif-search').value;
  fetch('https://api.giphy.com/v1/gifs/search?api_key=' + apiKey + '&q=' + searchTerm + '&limit=5')
    .then(response => response.json())
    .then(data => {
      const gifResults = document.getElementById('gif-results');
      gifResults.innerHTML = '';
      data.data.forEach(gif => {
        const img = document.createElement('img');
        img.src = gif.images.fixed_height.url;
        img.style = 'cursor: pointer; margin: 5px;';
        img.onclick = function() {
          sendGIF(gif.images.fixed_height.url);
        };
        gifResults.appendChild(img);
      });
    });
}

function sendGIF(url) {
  const username = document.getElementById('username').value;
  const color = document.getElementById('color').value;
  const emoji = document.getElementById('emoji').value;
  const description = document.getElementById('gif-description').value;

  socket.emit('sendGIF', { username: username, color: color, emoji: emoji, gif: url, description: description });
}

// Fonctionnalités administratives
function deleteMessage(index) {
  socket.emit('deleteMessage', index);
}

function banUser() {
  const username = document.getElementById('ban-username').value.trim();
  socket.emit('banUser', username);
}

function banIP() {
  const ip = document.getElementById('ban-ip').value.trim();
  socket.emit('banIP', ip);
}

function changeUserColor() {
  const username = document.getElementById('change-color-username').value.trim();
  const color = document.getElementById('change-color').value;
  socket.emit('changeUserColor', { username: username, color: color });
}

socket.on('messageDeleted', (index) => {
  messages.splice(index, 1);
  displayMessages();
});

socket.on('userBanned', (username) => {
  alert(`Utilisateur ${username} banni.`);
});

socket.on('userColorChanged', ({ username, color }) => {
  const userMessages = messages.filter(message => message.username === username);
  userMessages.forEach(message => message.color = color);
  displayMessages();
});
