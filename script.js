// DOM Elements
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const micButton = document.getElementById("micButton");
const voiceButton = document.getElementById("voiceButton");
const typingIndicator = document.getElementById("typingIndicator");

// Check if required elements exist
if (!chatArea || !userInput || !sendButton || !micButton) {
    console.error("Chat elements not found. Check your HTML IDs.");
}

// Show typing indicator
function showTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = "block";
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

// Hide typing indicator
function hideTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = "none";
    }
}

// Add message to chat (also saves to history)
function addMessage(content, isUser) {
    const messageDiv = document.createElement("div");
    messageDiv.className = isUser ? "message user-message" : "message ghost-message";

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="message-header">${isUser ? "You" : "Ghost"}</div>
        <div class="message-content">${content}</div>
        <div class="message-time">${timeStr}</div>
    `;

    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
    hideTyping();

    // Save to localStorage (chat history)
    const history = JSON.parse(localStorage.getItem("ghostChatHistory") || "[]");
    history.push({ content, isUser, timestamp: Date.now() });
    localStorage.setItem("ghostChatHistory", JSON.stringify(history));
}

// Load chat history on page load
function loadChatHistory() {
    const history = JSON.parse(localStorage.getItem("ghostChatHistory") || "[]");
    if (history.length === 0) return;

    history.forEach(msg => {
        const messageDiv = document.createElement("div");
        messageDiv.className = msg.isUser ? "message user-message" : "message ghost-message";

        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="message-header">${msg.isUser ? "You" : "Ghost"}</div>
            <div class="message-content">${msg.content}</div>
            <div class="message-time">${timeStr}</div>
        `;

        chatArea.appendChild(messageDiv);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
}

// Text-to-Speech with Indian Male Voice
const synth = window.speechSynthesis;
let isSpeaking = false;

// Get male voice
function getIndianMaleVoice() {
    const voices = synth.getVoices();
    const indianMale = voices.find(v =>
        v.lang === 'en-IN' &&
        (v.name.toLowerCase().includes('ravi') || v.name.toLowerCase().includes('google'))
    );
    const enMale = voices.find(v =>
        v.lang.startsWith('en') &&
        !v.name.toLowerCase().includes('female') &&
        !v.name.toLowerCase().includes('priya')
    );
    return indianMale || enMale || voices.find(v => v.lang.startsWith('en')) || voices[0];
}

// Load voices when available
synth.onvoiceschanged = () => {
    console.log("Speech voices loaded:", synth.getVoices().map(v => v.name));
};

// Remove emojis before speaking
function removeEmojis(text) {
    const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]|[\u2000-\u2FFF]|\u00A9|\u00AE|[\u2100-\u214F]|[\u2190-\u21FF]|\u231A|\u231B|\u23E9-\u23EF|\u23F0|\u23F1|\u23F2|\u23F3|\u23F8-\u23FA]|\u24C2|\u25AA|\u25AB|\u25B6|\u25C0|\u25FB-\u25FE]|\u2600-\u26FF]|\u2614|\u2615|\u2648-\u2653]|\u267F|\u2693|\u26A0|\u26A1|\u26AA|\u26AB|\u26BD|\u26BE|\u26C4|\u26C5|\u26CE|\u26CF|\u26D1|\u26D3|\u26D4|\u26E9|\u26EA|\u26F0-\u26FF]|\u2702|\u2705|\u2708-\u270D]|\u270F|\u2712|\u2714|\u2716|\u271D|\u2721|\u2728|\u2733|\u2734|\u2744|\u2747|\u274C|\u274E|\u2753-\u2755]|\u2757|\u2763|\u2764|\u2795-\u2797]|\u27A1|\u27B0|\u27BF|\u2934|\u2935|\u2B05-\u2B07]|\u2B1B|\u2B1C|\u2B50|\u2B55|\u3030|\u303D|\u3297|\u3299]|[\u00A0-\u00FF]|\u2000-\u206F]|\u2122|\u2139|\u3000-\u303F]|[\uD800-\uDBFF][\uDC00-\uDFFF])/g;
    return text.replace(emojiRegex, '').trim();
}

// Speak function
function speak(text) {
    if (isSpeaking) synth.cancel();

    const cleanText = removeEmojis(text);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = getIndianMaleVoice();
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    utterance.onstart = () => isSpeaking = true;
    utterance.onend = () => isSpeaking = false;
    utterance.onerror = () => isSpeaking = false;

    synth.speak(utterance);
}

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isMicOn = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    micButton.addEventListener("click", () => {
        isMicOn = !isMicOn;

        if (isMicOn) {
            try {
                recognition.start();
                micButton.innerHTML = "🔴 Mic On";
                micButton.style.background = "#d63031";
                userInput.placeholder = "Listening... (Click mic to stop)";
            } catch (e) {
                isMicOn = false;
                micButton.innerHTML = "🎤 Mic Off";
                micButton.style.background = "#8a8aff";
                addMessage("Microphone access denied or not supported.", false);
            }
        } else {
            recognition.stop();
            micButton.innerHTML = "🎤 Mic Off";
            micButton.style.background = "#8a8aff";
            userInput.placeholder = "Type or click mic to speak...";
        }
    });

    recognition.addEventListener("result", (e) => {
        const transcript = Array.from(e.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('')
            .trim();

        if (transcript) {
            userInput.value = transcript;
        }
    });

    recognition.addEventListener("end", () => {
        if (isMicOn) {
            recognition.start();
        } else {
            micButton.innerHTML = "🎤 Mic Off";
            micButton.style.background = "#8a8aff";
            userInput.placeholder = "Type or click mic to speak...";
        }
    });

    recognition.addEventListener("error", (event) => {
        if (isMicOn) {
            addMessage(`Microphone error: ${event.error}`, false);
            isMicOn = false;
            micButton.innerHTML = "🎤 Mic Off";
            micButton.style.background = "#8a8aff";
        }
    });
} else {
    addMessage("Speech Recognition not supported in your browser.", false);
    micButton.style.display = "none";
}

// Feature List
const featureList = `
✨ <strong>Here's what I can do:</strong><br><br>
✅ <strong>Math Help:</strong> "What is 25 × 17?"<br>
✅ <strong>Time & Date:</strong> "What time is it?"<br>
✅ <strong>Notes:</strong> "Note: Buy milk"<br>
✅ <strong>Timer:</strong> "Set timer for 5 minutes"<br>
✅ <strong>To-Do List:</strong> "Add: Call mom", "Show tasks"<br>
✅ <strong>BMI Calculator:</strong> "My weight 60kg, height 160cm"<br>
✅ <strong>Unit Converter:</strong> "5 km in miles", "10 kg to pounds"<br>
✅ <strong>Currency:</strong> "10 USD in INR"<br>
✅ <strong>YouTube Music:</strong> "Play Believer on YouTube"<br>
✅ <strong>QR Code:</strong> "Generate QR for 'Hello'"<br>
✅ <strong>Meditation:</strong> "Start 5-minute meditation"<br>
✅ <strong>Flashcards:</strong> "Teach me 5 Spanish words"<br>
✅ <strong>Jokes & Fun:</strong> "Tell me a joke"<br>
✅ <strong>Reminders:</strong> "Remind me to drink water"<br>
✅ <strong>Stop:</strong> Say "Stop" to cancel anything<br><br>
Just ask me anything! 😊
`.trim();

const featureVoiceMessage = "Here are the things I can help you with!";

// Open YouTube
function playOnYouTube(query) {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    window.open(url, "_blank");
}

// Core Logic
function getResponse(message) {
    const lower = message.toLowerCase().trim();

    // Stop command
    if (["stop", "shut up", "cancel", "quiet", "stop talking"].some(cmd => lower.includes(cmd))) {
        synth.cancel();
        isSpeaking = false;
        return "Okay, I'm stopping right away. 😶";
    }

    // ✅ Clear chat with password
    if (lower === "clear chat") {
        const password = prompt("🔐 Enter password to clear chat:\n\n");
        if (password === "Arpit@232422") {
            Array.from(chatArea.children).forEach(child => {
                if (child !== typingIndicator) {
                    child.remove();
                }
            });
            localStorage.removeItem("ghostChatHistory");
            return "✅ All Chats history Cleared successfully.";
        } else {
            return "❌ Incorrect password! Access denied.";
        }
    }

    // Help command
    if (lower.includes("what can you do") || lower.includes("help") || lower.includes("features")) {
        addMessage(featureList, false);
        safeSpeak(featureVoiceMessage);
        return;
    }

    // Greetings
    if (["hi", "hello", "hey", "hlo"].some(g => lower.includes(g))) {
        return "Hi there! I'm Ghost, How can I help you today?";
    }

    if (lower.includes("how are you")) {
        return "I'm doing great, thanks! How about you?";
    }

    if (lower.includes("your name")) {
        return "I'm Ghost — your AI friend !";
    }

    if (lower.includes("your owner") || lower.includes("who made you") || lower.includes("who created you")) {
        return "I'm Ghost — Made By Arpit Pandey!";
    }
    if (lower.includes("My Name") || lower.includes("my name") || lower.includes("who am i")) {
        return "You are Arpit Pandey!";
    }

    // Time & Date
    if (lower.includes("time")) {
        return `The current time is ${new Date().toLocaleTimeString()}.`;
    }

    if (lower.includes("date") || lower.includes("today")) {
        return `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    }

    // Math: Solve expressions like 1+2+3+4+5 or 10*2+5-3
const mathRegex = /^([+\-]?(?:\d+\.?\d*|\.\d+)(?:[+\-*/](?:\d+\.?\d*|\.\d+))*)$/;

if (mathRegex.test(message)) {
    try {
        let expr = message.replace(/x/g, '*');

        // Security: Only allow safe math characters
        if (/[^0-9+\-*/().\s]/.test(expr)) {
            return "❌ Invalid characters in math expression.";
        }

        // Evaluate safely without direct eval
        const result = Function('"use strict"; return (' + expr + ')')();

        if (isNaN(result) || !isFinite(result)) {
            return "❌ Cannot calculate this expression.";
        }

        return `🧮 Result: ${message} = ${result}`;
    } catch (e) {
        return "❌ I couldn't solve this math problem.";
    }
}

    // Timer
    const timerMatch = lower.match(/set a? timer for (\d+) (seconds?|minutes?)/);
    if (timerMatch) {
        const value = parseInt(timerMatch[1]);
        const unit = timerMatch[2];
        const ms = unit.startsWith("min") ? value * 60000 : value * 1000;

        setTimeout(() => {
            alert(`⏰ Timer done! ${value} ${unit} completed.`);
        }, ms);

        return `✅ Timer set for ${value} ${unit}. I'll alert you when it's done!`;
    }

    // Notes
    if (lower.startsWith("note:") || lower.startsWith("save:")) {
        const note = message.slice(message.indexOf(":") + 1).trim();
        const notes = JSON.parse(localStorage.getItem("ghostNotes") || "[]");
        notes.push({ text: note, time: new Date().toLocaleString() });
        localStorage.setItem("ghostNotes", JSON.stringify(notes));
        return `📝 Note saved: "${note}"`;
    }

    if (lower.includes("my notes") || lower.includes("saved notes")) {
        const notes = JSON.parse(localStorage.getItem("ghostNotes") || "[]");
        if (notes.length === 0) return "You have no notes yet. Use 'note: your text' to save one!";
        return "📒 Your notes:\n" + notes.map(n => `- "${n.text}" (${n.time})`).join("\n");
    }

    // BMI
    const weightMatch = lower.match(/weight.*?(\d+(\.\d+)?)/i);
    const heightMatch = lower.match(/height.*?(\d+(\.\d+)?)/i);
    if (weightMatch && heightMatch) {
        const weight = parseFloat(weightMatch[1]);
        let height = parseFloat(heightMatch[1]);
        if (height > 3) height = height / 100;
        const bmi = weight / (height * height);
        const category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
        return `🧮 Your BMI is ${bmi.toFixed(1)} (${category}).`;
    }

    // YouTube Music
    if (lower.includes("play") && (lower.includes("youtube") || lower.includes("song") || lower.includes("music"))) {
        const queryMatch = message.match(/play (.+?) on youtube/i);
        const songName = queryMatch ? queryMatch[1] : message.replace(/play|song|music/gi, "").trim();

        if (songName.trim()) {
            setTimeout(() => playOnYouTube(songName), 1000);
            return `🎵 Playing "${songName}" on YouTube...`;
        }
    }

    // Default response
    return "I'm here to help! Try asking 'what can you do' to see my features.";
}

// Send Message
function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    userInput.value = "";
    showTyping();

    setTimeout(() => {
        const response = getResponse(message);
        if (response !== undefined) {
            addMessage(response, false);
            safeSpeak(response);
        }
    }, 1000 + Math.random() * 500);
}

// === VOICE TOGGLE FEATURE ===
let voiceEnabled = JSON.parse(localStorage.getItem("ghostVoiceEnabled")) !== false;

function updateVoiceButton() {
    if (voiceButton) {
        voiceButton.textContent = voiceEnabled ? "🔊" : "🔇";
        voiceButton.title = voiceEnabled ? "Click to disable voice" : "Click to enable voice";
    }
}

if (voiceButton) {
    voiceButton.addEventListener("click", () => {
        voiceEnabled = !voiceEnabled;
        localStorage.setItem("ghostVoiceEnabled", JSON.stringify(voiceEnabled));
        updateVoiceButton();
        addMessage(`🎙️ Voice output is now ${voiceEnabled ? "ON" : "OFF"}`, false);
    });
}

function safeSpeak(text) {
    if (voiceEnabled && text) {
        speak(text);
    }
}

updateVoiceButton();

// Event Listeners
sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

// Load voices and chat history on first click
document.addEventListener("click", () => {
    if (synth.getVoices().length === 0) {
        synth.getVoices();
    }

    if (!window.chatHistoryLoaded) {
        loadChatHistory();
        window.chatHistoryLoaded = true;

        // Show welcome message only if no messages exist
        if (chatArea.children.length <= 1) {
            addMessage("Hello! I'm Ghost, your AI assistant. How can I help you today?", false);
        }
    }
}, { once: true });

// Hide typing indicator on load
hideTyping();