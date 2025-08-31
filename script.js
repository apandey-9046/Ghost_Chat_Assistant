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
        <div class="message-sender">${isUser ? "You" : "Ghost"}</div>
        <div class="message-bubble">${content}</div>
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
            <div class="message-sender">${msg.isUser ? "You" : "Ghost"}</div>
            <div class="message-bubble">${msg.content}</div>
            <div class="message-time">${timeStr}</div>
        `;

        chatArea.appendChild(messageDiv);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
}

// Text-to-Speech with Single Reliable Male Voice
const synth = window.speechSynthesis;
let isSpeaking = false;

// Use Google US English (male) - works across devices
function getSingleMaleVoice() {
    const voices = synth.getVoices();

    // Try to find Google US English (most consistent)
    const googleVoice = voices.find(v =>
        v.name.toLowerCase().includes('google') &&
        v.lang === 'en-US' &&
        !v.name.toLowerCase().includes('female')
    );

    // Fallback: any non-female en-US voice
    if (googleVoice) return googleVoice;

    // Final fallback: first non-female en voice
    const maleEnVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        !v.name.toLowerCase().includes('female') &&
        !v.name.toLowerCase().includes('voice')
    );

    return maleEnVoice || voices[0]; // Last resort: first available voice
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

// Speak function using single male voice
function speak(text) {
    if (isSpeaking) synth.cancel();

    const cleanText = removeEmojis(text);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = getSingleMaleVoice(); // ← Uses Google US English (male)
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
                micButton.innerHTML = "🔴";
                userInput.placeholder = "Listening... (Click mic to stop)";
            } catch (e) {
                isMicOn = false;
                micButton.innerHTML = "🎤";
                addMessage("Microphone access denied or not supported.", false);
            }
        } else {
            recognition.stop();
            micButton.innerHTML = "🎤";
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
            micButton.innerHTML = "🎤";
            userInput.placeholder = "Type or click mic to speak...";
        }
    });

    recognition.addEventListener("error", (event) => {
        if (isMicOn) {
            addMessage(`Microphone error: ${event.error}`, false);
            isMicOn = false;
            micButton.innerHTML = "🎤";
        }
    });
} else {
    addMessage("Speech Recognition not supported in your browser.", false);
    micButton.style.display = "none";
}

// Feature List
let featureList = `
✨ <strong>Here's what I can do:</strong><br><br>
✅ <strong>Math Help:</strong> "What is 25 × 17?"<br>
✅ <strong>Time & Date:</strong> "What time is it?"<br>
✅ <strong>Notes:</strong> "Note: Buy milk"<br>
✅ <strong>Timer:</strong> "Set timer for 5 minutes"<br>
✅ <strong>To-Do List:</strong> "Add: Call mom", "Show tasks", "Remove: 1"<br>
✅ <strong>BMI Calculator:</strong> "My weight 60kg, height 160cm"<br>
✅ <strong>Unit Converter:</strong> "5 km in miles", "10 kg to pounds"<br>
✅ <strong>Currency:</strong> "10 USD in INR"<br>
✅ <strong>YouTube Music:</strong> "Play Believer on YouTube"<br>
✅ <strong>QR Code:</strong> "Generate QR for 'Hello'"<br>
✅ <strong>Meditation:</strong> "Start 5-minute meditation"<br>
✅ <strong>Flashcards:</strong> "Teach me 5 Spanish words"<br>
✅ <strong>Jokes & Fun:</strong> "Tell me a joke"<br>
✅ <strong>Reminders:</strong> "Remind me to drink water in 5 min"<br>
✅ <strong>Quiz:</strong> "Let's play quiz", "Start quiz", "Quiz time"<br>
✅ <strong>Rock Paper Scissors:</strong> "Play rps", "RPS", "Let's play a game"<br>
✅ <strong>Stop:</strong> Say "Stop" to cancel anything<br><br>
Just ask me anything! 😊
`.trim();

const featureVoiceMessage = "Here are the things I can help you with!";

// === GENERAL KNOWLEDGE QUIZ QUESTIONS & ANSWERS (with A/B/C/D options) ===
const gkQuiz = [
    {
        question: "What is the capital of India?",
        options: ["A) Mumbai", "B) Kolkata", "C) New Delhi", "D) Chennai"],
        answer: "C"
    },
    // Add more questions here...
];

// Open YouTube
function playOnYouTube(query) {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    window.open(url, "_blank");
}

// === TASK MANAGER ===
function getTasks() {
    return JSON.parse(localStorage.getItem("ghostTasks") || "[]");
}

function saveTasks(tasks) {
    localStorage.setItem("ghostTasks", JSON.stringify(tasks));
}

// === REMINDER SYSTEM ===
let activeReminders = [];

// Cancel all reminders
function cancelAllReminders() {
    activeReminders.forEach(timerId => clearTimeout(timerId));
    activeReminders = [];
    return "✅ All reminders cancelled.";
}

// === QUIZ SYSTEM (Global Variables) ===
let quizActive = false;
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let quizTimer;

// Create audio elements
const correctSound = new Audio("https://www.soundjay.com/buttons/sounds/button-09.mp3");
const wrongSound = new Audio("https://www.soundjay.com/buttons/sounds/button-10.mp3");

function playCorrectSound() {
    correctSound.currentTime = 0;
    correctSound.play().catch(() => { });
}

function playWrongSound() {
    wrongSound.currentTime = 0;
    wrongSound.play().catch(() => { });
}

// Clear quiz timer
function clearQuizTimer() {
    if (quizTimer) clearTimeout(quizTimer);
}

// Start quiz timer (10 seconds)
function startQuizTimer() {
    clearQuizTimer();
    quizTimer = setTimeout(() => {
        if (quizActive && quizIndex < quizQuestions.length) {
            addMessage(`⏰ Time's up! Correct answer was: ${quizQuestions[quizIndex].answer}`, false);
            playWrongSound();
            quizIndex++;
            if (quizIndex < quizQuestions.length) {
                showNextQuestion();
            } else {
                endQuiz();
            }
        }
    }, 10000);
}

// Show next question
function showNextQuestion() {
    const q = quizQuestions[quizIndex];
    const optionsText = q.options.join("<br>");
    const msg = `🎯 Q${quizIndex + 1}: ${q.question}<br><br>${optionsText}`;
    setTimeout(() => {
        addMessage(msg, false);
        startQuizTimer();
    }, 500);
}

// End quiz
function endQuiz() {
    quizActive = false;
    clearQuizTimer();
    const msg = `🎉 Quiz Completed!\nYou scored ${quizScore} out of ${quizQuestions.length}.`;
    addMessage(msg, false);
    safeSpeak(`Quiz completed! You scored ${quizScore} out of ${quizQuestions.length}.`);
}

// === ROCK PAPER SCISSORS GAME ===
let rpsGameActive = false;

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
        const password = prompt("🔐 Enter password to clear chat:\n\nPassword: Arpit@232422");
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
    if (["what can you do", "help", "features", "what can you do"].some(cmd => lower.includes(cmd))) {
        addMessage(featureList, false);
        safeSpeak(featureVoiceMessage);
        return;
    }

    // === QUIZ TRIGGERS ===
    const quizTriggers = [
        "let's play quiz", "play quiz", "start quiz", "quiz time", "quiz", "i want to play quiz"
    ];

    if (quizTriggers.some(trigger => lower === trigger)) {
        quizActive = true;
        quizScore = 0;
        quizIndex = 0;
        quizQuestions = [...gkQuiz].sort(() => 0.5 - Math.random()).slice(0, 10);
        addMessage("🎯 Quiz Started! 10 questions, 10 seconds each. Let's begin!", false);
        showNextQuestion();
        return;
    }

    // Exit quiz
    if (["exit quiz", "stop quiz", "quit quiz", "end quiz"].includes(lower)) {
        if (quizActive) {
            quizActive = false;
            clearQuizTimer();
            return "👋 Quiz exited. You can start again anytime!";
        } else {
            return "No quiz is active right now.";
        }
    }

    // Handle quiz answer
    if (quizActive) {
        const ans = message.trim().toUpperCase();
        const correct = quizQuestions[quizIndex].answer;

        clearQuizTimer();

        if (ans === correct) {
            quizScore++;
            addMessage("✅ Correct!", false);
            playCorrectSound();
        } else {
            addMessage(`❌ Wrong! Correct answer was: ${correct}`, false);
            playWrongSound();
        }

        quizIndex++;

        if (quizIndex < quizQuestions.length) {
            showNextQuestion();
        } else {
            endQuiz();
        }
        return;
    }

    // === ROCK PAPER SCISSORS GAME ===
    const rpsTriggers = ["rps", "rock paper scissors", "play rps", "lets play game", "game", "play game"];
    if (rpsTriggers.some(trigger => lower === trigger)) {
        rpsGameActive = true;
        return "🎮 Let's play Rock-Paper-Scissors!<br>Choose: <strong>Rock</strong>, <strong>Paper</strong>, or <strong>Scissors</strong>.";
    }

    if (rpsGameActive) {
        const userChoice = lower;
        const choices = ["rock", "paper", "scissors"];
        const botChoice = choices[Math.floor(Math.random() * 3)];

        if (!choices.includes(userChoice)) {
            return "❌ Invalid choice! Choose Rock, Paper, or Scissors.";
        }

        let result;
        if (userChoice === botChoice) {
            result = "It's a tie!";
        } else if (
            (userChoice === "rock" && botChoice === "scissors") ||
            (userChoice === "paper" && botChoice === "rock") ||
            (userChoice === "scissors" && botChoice === "paper")
        ) {
            result = "You win! 🎉";
        } else {
            result = "You lose! 😢";
        }

        rpsGameActive = false;
        return `You: ${userChoice.toUpperCase()}<br>Ghost: ${botChoice.toUpperCase()}<br><br>👉 ${result}`;
    }

    // Greetings
    if (["hi", "hello", "hey", "hlo", "namaste"].some(g => lower.includes(g))) {
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
    if (lower.includes("my name") || lower.includes("who am i")) {
        return "Your Name Is Arpit!";
    }

    // Time & Date
    if (lower.includes("time")) {
        return `The current time is ${new Date().toLocaleTimeString()}.`;
    }

    if (lower.includes("date") || lower.includes("today")) {
        return `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    }

    // Math
    if (lower.includes("what is") || lower.includes("solve") || lower.includes("calculate")) {
        const mathRegex = /^([+\-]?(?:\d+\.?\d*|\.\d+)(?:[+\-*/](?:\d+\.?\d*|\.\d+))*)$/;
        if (mathRegex.test(message)) {
            try {
                let expr = message.replace(/x/g, '*');
                if (/[^0-9+\-*/().\s]/.test(expr)) {
                    return "❌ Invalid characters in math expression.";
                }
                const result = Function('"use strict"; return (' + expr + ')')();
                if (isNaN(result) || !isFinite(result)) {
                    return "❌ Cannot calculate this expression.";
                }
                return `🧮 Result: ${message} = ${result}`;
            } catch (e) {
                return "❌ I couldn't solve this math problem.";
            }
        }
    }

    // === REMINDERS ===
    if (lower.includes("remind me") || lower.includes("set reminder") || lower.includes("alert me in")) {
        const remindMatch1 = lower.match(/remind me to (.+?) in (\d+) (seconds?|minutes?|hours?)/);
        const remindMatch2 = lower.match(/set a reminder for (\d+) (seconds?|minutes?|hours?)(?: to (.+?))?$/);

        if (remindMatch1 || remindMatch2) {
            const [_, task, timeValue, unit, extraTask] = remindMatch1 || [...remindMatch2];
            const finalTask = task || extraTask?.trim() || "this task";
            const value = parseInt(timeValue);
            let ms;

            if (unit.startsWith("sec")) ms = value * 1000;
            else if (unit.startsWith("min")) ms = value * 60000;
            else if (unit.startsWith("hour")) ms = value * 3600000;

            const timerId = setTimeout(() => {
                alert(`🔔 Reminder: ${finalTask}`);
            }, ms);

            activeReminders.push(timerId);

            const displayUnit = unit.startsWith("hour") ? "hour" : unit;
            return `✅ I'll remind you to "${finalTask}" in ${value} ${displayUnit}${value !== 1 ? 's' : ''}.`;
        }
    }

    // === TASK MANAGER (To-Do List) ===
    if (lower.startsWith("add:") || lower.includes("add task") || lower.includes("create task") || lower.includes("add new task") || lower.includes("create task")) {
        const task = message.slice(message.indexOf(":") + 1).trim() || message.replace("add task , create task, add new task , create task", "").trim();
        if (!task) return "❌ Please provide a task to add.";

        const tasks = getTasks();
        tasks.push({ text: task, time: new Date().toLocaleString() });
        saveTasks(tasks);
        return `✅ Task added: "${task}"`;
    }

    if (lower.includes("show tasks") || lower.includes("my tasks") || lower.includes("todo")) {
        const tasks = getTasks();
        if (tasks.length === 0) return "📋 No tasks yet. Use 'Add: Task name' to add one.";

        let table = `
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
                <tr style="background: #2d2d2d; color: white;">
                    <th style="text-align: left;">#</th>
                    <th style="text-align: left;">Task</th>
                    <th style="text-align: left;">Added On</th>
                </tr>
        `;

        tasks.forEach((task, i) => {
            table += `
                <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                    <td>${i + 1}</td>
                    <td>${task.text}</td>
                    <td>${task.time}</td>
                </tr>
            `;
        });

        table += `</table>`;
        return table;
    }

    // Notes
    if (lower.startsWith("note:") || lower.startsWith("save:") || lower.includes("save note")) {
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
    if (lower.includes("weight") && lower.includes("height") || lower.includes("bmi")) {
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

        if (chatArea.children.length <= 1) {
            addMessage("Hello! I'm Ghost, your AI assistant. How can I help you today?", false);
        }
    }
}, { once: true });

// Hide typing indicator on load
hideTyping();