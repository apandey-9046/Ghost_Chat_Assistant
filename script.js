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
✅ <strong>Quiz:</strong> "Let's play quiz"<br>
✅ <strong>Stop:</strong> Say "Stop" to cancel anything<br><br>
Just ask me anything! 😊
`.trim();

const featureVoiceMessage = "Here are the things I can help you with!";

// === GENERAL KNOWLEDGE QUIZ QUESTIONS & ANSWERS ===
const gkQuiz = [
    { question: "What is the capital of India?", answer: "New Delhi" },
    { question: "Who is known as the Father of the Nation in India?", answer: "Mahatma Gandhi" },
    { question: "Which planet is known as the Red Planet?", answer: "Mars" },
    { question: "What is the largest ocean on Earth?", answer: "Pacific Ocean" },
    { question: "Which gas do plants absorb from the atmosphere?", answer: "Carbon Dioxide" },
    { question: "What is the chemical symbol for water?", answer: "H2O" },
    { question: "Which country is known as the Land of the Rising Sun?", answer: "Japan" },
    { question: "Who wrote the Indian National Anthem?", answer: "Rabindranath Tagore" },
    { question: "How many continents are there in the world?", answer: "7" },
    { question: "What is the longest river in the world?", answer: "Nile River" },
    { question: "Which animal is known as the 'Ship of the Desert'?", answer: "Camel" },
    { question: "What is the tallest mountain in the world?", answer: "Mount Everest" },
    { question: "Which planet is closest to the Sun?", answer: "Mercury" },
    { question: "What is the smallest country in the world?", answer: "Vatican City" },
    { question: "Which organ pumps blood in the human body?", answer: "Heart" },
    { question: "Which language is spoken in Brazil?", answer: "Portuguese" },
    { question: "What is the currency of Japan?", answer: "Yen" },
    { question: "Which planet has rings around it?", answer: "Saturn" },
    { question: "Who invented the telephone?", answer: "Alexander Graham Bell" },
    { question: "What is the largest desert in the world?", answer: "Sahara Desert" },
    { question: "Which country hosted the 2020 Summer Olympics?", answer: "Japan" },
    { question: "What is the capital of Australia?", answer: "Canberra" },
    { question: "Which gas is most abundant in Earth's atmosphere?", answer: "Nitrogen" },
    { question: "Who painted the Mona Lisa?", answer: "Leonardo da Vinci" },
    { question: "What is the largest mammal in the world?", answer: "Blue Whale" },
    { question: "Which country is the largest by area?", answer: "Russia" },
    { question: "In which year did India gain independence?", answer: "1947" },
    { question: "What is the full form of WWW?", answer: "World Wide Web" },
    { question: "Which is the coldest place on Earth?", answer: "Antarctica" },
    { question: "Which metal is liquid at room temperature?", answer: "Mercury" },
    { question: "Which country is known as the Gift of the Nile?", answer: "Egypt" },
    { question: "Who is the author of 'Harry Potter' series?", answer: "J.K. Rowling" },
    { question: "Which is the largest state in India by area?", answer: "Rajasthan" },
    { question: "Which planet is known for the Great Red Spot?", answer: "Jupiter" },
    { question: "What is the national bird of India?", answer: "Peacock" },
    { question: "Which country has the most population?", answer: "India" },
    { question: "What is the capital of Canada?", answer: "Ottawa" },
    { question: "Which element has the chemical symbol 'O'?", answer: "Oxygen" },
    { question: "Which is the fastest animal on land?", answer: "Cheetah" },
    { question: "Who discovered gravity?", answer: "Isaac Newton" },
    { question: "What is the national animal of India?", answer: "Tiger" },
    { question: "Which country is known as the Silicon Valley of India?", answer: "Bangalore" },
    { question: "Which is the longest wall in the world?", answer: "Great Wall of China" },
    { question: "Which planet is called Earth's twin?", answer: "Venus" },
    { question: "Which is the smallest continent?", answer: "Australia" },
    { question: "What is the capital of France?", answer: "Paris" },
    { question: "Which is the largest island in the world?", answer: "Greenland" },
    { question: "Who is known as the Missile Man of India?", answer: "Dr. A.P.J. Abdul Kalam" },
    { question: "Which is the brightest planet in the night sky?", answer: "Venus" },
    { question: "What is the currency of the United Kingdom?", answer: "Pound Sterling" },
    { question: "Which country has the largest number of time zones?", answer: "Russia" }
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
    if (lower.includes("what can you do") || lower.includes("help") || lower.includes("features")) {
        addMessage(featureList, false);
        safeSpeak(featureVoiceMessage);
        return;
    }

    // === QUIZ SYSTEM ===
    if (lower === "let's play quiz" || lower === "play quiz") {
        quizActive = true;
        quizScore = 0;
        quizIndex = 0;
        quizQuestions = [...gkQuiz].sort(() => 0.5 - Math.random()).slice(0, 10);
        return `🎯 Quiz Started! I'll ask 10 questions. Let's begin!\n\nQ1: ${quizQuestions[0].question}`;
    }

    if (quizActive) {
        const correctAnswer = quizQuestions[quizIndex].answer.toLowerCase().trim();
        const userAnswer = message.toLowerCase().trim();

        if (userAnswer === correctAnswer) {
            quizScore++;
            addMessage("✅ Correct!", false);
        } else {
            addMessage(`❌ Wrong! Correct answer was: ${quizQuestions[quizIndex].answer}`, false);
        }

        quizIndex++;

        if (quizIndex < quizQuestions.length) {
            return `Q${quizIndex + 1}: ${quizQuestions[quizIndex].question}`;
        } else {
            const finalScore = `🎉 Quiz Completed!\nYou scored ${quizScore} out of ${quizQuestions.length}.`;
            quizActive = false;
            return finalScore;
        }
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
    if (lower.includes("my name") || lower.includes("who am i")) {
        return "You are Arpit Pandey!";
    }

    // Time & Date
    if (lower.includes("time")) {
        return `The current time is ${new Date().toLocaleTimeString()}.`;
    }

    if (lower.includes("date") || lower.includes("today")) {
        return `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    }

    // Math
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

    // === REMINDERS ===
    const remindMatch1 = lower.match(/remind me to (.+?) in (\d+) (seconds?|minutes?|hours?)/);
    const remindMatch2 = lower.match(/set a reminder for (\d+) (seconds?|minutes?|hours?)(?: to (.+?))?$/);
    const cancelReminders = lower.includes("cancel all reminders");

    if (cancelReminders) {
        return cancelAllReminders();
    }

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

    // === TASK MANAGER (To-Do List) ===
    const addTaskMatch = lower.startsWith("add:");
    const showTasks = lower.includes("show tasks") || lower.includes("my tasks");
    const removeTaskMatch = lower.match(/remove:\s*(\d+)/i);

    if (addTaskMatch) {
        const task = message.slice(4).trim();
        if (!task) return "❌ Please provide a task to add.";

        const tasks = getTasks();
        tasks.push({ text: task, time: new Date().toLocaleString() });
        saveTasks(tasks);
        return `✅ Task added: "${task}"`;
    }

    if (showTasks) {
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

    if (removeTaskMatch) {
        const index = parseInt(removeTaskMatch[1]) - 1;
        const tasks = getTasks();

        if (index < 0 || index >= tasks.length) {
            return "❌ Invalid task number.";
        }

        const removed = tasks.splice(index, 1)[0];
        saveTasks(tasks);
        return `🗑️ Removed task: "${removed.text}"`;
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

        if (chatArea.children.length <= 1) {
            addMessage("Hello! I'm Ghost, your AI assistant. How can I help you today?", false);
        }
    }
}, { once: true });

// Hide typing indicator on load
hideTyping();