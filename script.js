// Global DOM elements for the chat interface
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const micButton = document.getElementById("micButton");
const voiceButton = document.getElementById("voiceButton");
const typingIndicator = document.getElementById("typingIndicator");

// Global variables for prompt system handling
let awaitingTaskInput = false;
let awaitingReminderInput = false;
let awaitingReminderTime = false;
let tempReminderText = "";

// Check for required DOM elements and log error if missing
if (!chatArea || !userInput || !sendButton || !micButton) {
    console.error("Chat elements not found. Check your HTML IDs.");
}

// Function to display typing indicator in chat area
function showTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = "block";
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

// Function to hide typing indicator from chat area
function hideTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = "none";
    }
}

// Function to add a message to the chat area and save to history
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

    // Debounced saving of chat history to localStorage
    if (window.saveHistoryTimeout) {
        clearTimeout(window.saveHistoryTimeout);
    }
    window.saveHistoryTimeout = setTimeout(() => {
        const history = JSON.parse(localStorage.getItem("ghostChatHistory") || "[]");
        history.push({ content, isUser, timestamp: Date.now() });
        localStorage.setItem("ghostChatHistory", JSON.stringify(history));
    }, 100);
}

// Function to load chat history from localStorage with error handling
function loadChatHistory() {
    try {
        const history = JSON.parse(localStorage.getItem("ghostChatHistory") || "[]");
        if (history.length === 0) return;

        history.forEach(msg => {
            const messageDiv = document.createElement("div");
            messageDiv.className = msg.isUser ? "message user-message" : "message ghost-message";

            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            messageDiv.innerHTML = `
                <div class="message-sender">${msg.isUser ? "Ghost" : "Ghost"}</div>
                <div class="message-bubble">${msg.content}</div>
                <div class="message-time">${timeStr}</div>
            `;

            chatArea.appendChild(messageDiv);
        });
        chatArea.scrollTop = chatArea.scrollHeight;
    } catch (e) {
        console.error("Error loading chat history:", e);
        addMessage("❌ Error loading chat history", false);
    }
}

// Speech synthesis setup and variables
const synth = window.speechSynthesis;
let isSpeaking = false;

// Platform-specific voices for offline use
const platformVoices = {
    windows: [
        { name: 'David', voiceName: 'Microsoft David Desktop', gender: 'male' },
        { name: 'Zira', voiceName: 'Microsoft Zira Desktop', gender: 'female' }
    ],
    macos: [
        { name: 'Alex', voiceName: 'Alex', gender: 'male' },
        { name: 'Samantha', voiceName: 'Samantha', gender: 'female' }
    ],
    android: [
        { name: 'Google Male', voiceName: 'en-US-Standard-D', gender: 'male' },
        { name: 'Google Female', voiceName: 'en-US-Standard-C', gender: 'female' }
    ],
    ios: [
        { name: 'Siri Male', voiceName: 'Siri Male (English (United States))', gender: 'male' },
        { name: 'Siri Female', voiceName: 'Siri Female (English (United States))', gender: 'female' }
    ],
    default: [
        { name: 'Default Male', voiceName: 'en-US-Standard-D', gender: 'male' },
        { name: 'Default Female', voiceName: 'en-US-Standard-C', gender: 'female' }
    ]
};

let availableVoices = [];
let currentVoiceName = '';

// Function to detect platform based on user agent
function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('windows')) return 'windows';
    if (userAgent.includes('macintosh')) return 'macos';
    if (userAgent.includes('android')) return 'android';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
    return 'default';
}

// Modified: Improved voice fallback for mobile devices
function getPreferredVoice() {
    const voices = synth.getVoices();
    const platform = detectPlatform();
    const platformVoiceList = platformVoices[platform] || platformVoices.default;

    availableVoices = platformVoiceList.map(v => v.name);

    if (!currentVoiceName) {
        currentVoiceName = platformVoiceList[0].voiceName;
    }

    const selectedVoice = voices.find(v => v.name === currentVoiceName);
    if (!selectedVoice) {
        console.warn(`Voice "${currentVoiceName}" not found, falling back to any English voice`);
        // Fallback to any en-US voice or first available voice
        return voices.find(v => v.lang === 'en-US') || voices[0] || null;
    }
    return selectedVoice;
}

// Load voices when available
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    console.log("Available voices:", voices.map(v => ({
        name: v.name,
        lang: v.lang,
        default: v.default
    })));
    if (!currentVoiceName) {
        const platform = detectPlatform();
        currentVoiceName = (platformVoices[platform] || platformVoices.default)[0].voiceName;
    }
};

// Function to remove emojis from text
function removeEmojis(text) {
    const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]|[\u2000-\u2FFF]|\u00A9|\u00AE|[\u2100-\u214F]|[\u2190-\u21FF]|\u231A|\u231B|\u23E9-\u23EF|\u23F0|\u23F1|\u23F2|\u23F3|\u23F8-\u23FA]|\u24C2|\u25AA|\u25AB|\u25B6|\u25C0|\u25FB-\u25FE]|\u2600-\u26FF]|\u2614|\u2615|\u2648-\u2653]|\u267F|\u2693|\u26A0|\u26A1|\u26AA|\u26AB|\u26BD|\u26BE|\u26C4|\u26C5|\u26CE|\u26CF|\u26D1|\u26D3|\u26D4|\u26E9|\u26EA|\u26F0-\u26FF]|\u2702|\u2705|\u2708-\u270D]|\u270F|\u2712|\u2714|\u2716|\u271D|\u2721|\u2728|\u2733|\u2734|\u2744|\u2747|\u274C|\u274E|\u2753-\u2755]|\u2757|\u2763|\u2764|\u2795-\u2797]|\u27A1|\u27B0|\u27BF|\u2934|\u2935|\u2B05-\u2B07]|\u2B1B|\u2B1C|\u2B50|\u2B55|\u3030|\u303D|\u3297|\u3299]|[\u00A0-\u00FF]|\u2000-\u206F]|\u2122|\u2139|\u3000-\u303F]|[\uD800-\uDBFF][\uDC00-\uDFFF])/g;
    return text.replace(emojiRegex, '').trim();
}

// Function to strip HTML tags from text
function stripHtml(html) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
}

// Function to speak text using speech synthesis
function speak(text) {
    if (isSpeaking || !voiceEnabled) return;
    synth.cancel(); // Cancel any ongoing speech
    isSpeaking = true;

    const textToSpeak = stripHtml(removeEmojis(text));
    if (!textToSpeak) {
        isSpeaking = false;
        return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const selectedVoice = getPreferredVoice();
    if (!selectedVoice) {
        console.error("No voice available for speech synthesis");
        isSpeaking = false;
        return;
    }
    utterance.voice = selectedVoice;
    console.log("Selected voice:", selectedVoice.name); // Debug voice selection
    utterance.rate = 0.95; // Slightly slower for natural feel
    utterance.pitch = 1.1; // Slightly higher for clarity
    utterance.volume = 1;

    utterance.onstart = () => {
        isSpeaking = true;
        if (isMicOn) recognition.stop();
    };

    utterance.onend = () => {
        isSpeaking = false;
        if (isMicOn) {
            setTimeout(() => {
                if (isMicOn && !isSpeaking) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log("Could not restart recognition after speech.");
                    }
                }
            }, 500);
        }
    };

    utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        isSpeaking = false;
        if (isMicOn) {
            setTimeout(() => {
                if (isMicOn && !isSpeaking) {
                    try {
                        recognition.start();
                    } catch (err) {
                        console.log("Could not restart recognition after speech error.");
                    }
                }
            }, 500);
        }
    };

    synth.speak(utterance);
}

// Function to switch voice
function switchVoice(voiceName) {
    const platform = detectPlatform();
    const voiceList = platformVoices[platform] || platformVoices.default;
    const voice = voiceList.find(v => v.name.toLowerCase() === voiceName.toLowerCase());
    if (voice) {
        currentVoiceName = voice.voiceName;
        const sampleText = "This is a sample in the new voice.";
        console.log(`Switching to voice: ${voice.name} (${voice.voiceName})`);
        addMessage(`🔊 Voice switched to ${voice.name}. Sample: ${sampleText}`, false);
        safeSpeak(sampleText);
    } else {
        addMessage(`❌ Voice "${voiceName}" not available. Use: ${voiceList.map(v => v.name).join(', ')}`, false);
    }
}

// Function to list available voices
function listVoices() {
    const platform = detectPlatform();
    const voiceList = platformVoices[platform] || platformVoices.default;
    return `Available voices: ${voiceList.map(v => v.name).join(', ')}. Note: Voice availability depends on your device and browser.`;
}

// Modified: Speech recognition setup with extended timeout and sensitivity
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isMicOn = false;
let recognitionStartTime = null;
let noSpeechTimeout = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true; // Changed: Enable interim results for slower speech
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    micButton.addEventListener("click", () => {
        isMicOn = !isMicOn;

        if (isMicOn) {
            try {
                recognition.start();
                recognitionStartTime = Date.now();
                micButton.innerHTML = "🔴";
                micButton.style.color = "#ff4757";
                userInput.placeholder = "Listening... (Click mic to stop)";
                userInput.disabled = true;

                // New: Set 10-second timeout for no speech
                noSpeechTimeout = setTimeout(() => {
                    if (isMicOn) {
                        recognition.stop();
                        addMessage("❌ No speech detected. Mic stopped.", false);
                        isMicOn = false;
                        micButton.innerHTML = "🎤";
                        micButton.style.color = "#aebac1";
                        userInput.placeholder = "Type or click mic to speak...";
                        userInput.disabled = false;
                    }
                }, 10000); // 10 seconds timeout
            } catch (e) {
                isMicOn = false;
                micButton.innerHTML = "🎤";
                micButton.style.color = "#aebac1";
                userInput.disabled = false;
                addMessage("❌ Microphone access denied", false);
            }
        } else {
            try {
                recognition.stop();
                clearTimeout(noSpeechTimeout);
            } catch (e) {
                console.log("Recognition already stopped");
            }
            micButton.innerHTML = "🎤";
            micButton.style.color = "#aebac1";
            userInput.placeholder = "Type or click mic to speak...";
            userInput.disabled = false;
        }
    });

    recognition.addEventListener("result", (e) => {
        const transcript = Array.from(e.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('')
            .trim();

        if (transcript) {
            clearTimeout(noSpeechTimeout); // Clear timeout if speech detected
            userInput.value = transcript;
            setTimeout(() => {
                if (isMicOn && e.results[0].isFinal) { // Only send on final result
                    sendMessage();
                }
            }, 1000); // Changed: Increased delay for slower speech
        }
    });

    recognition.addEventListener("end", () => {
        if (isMicOn && !isSpeaking) {
            setTimeout(() => {
                if (isMicOn && !isSpeaking) {
                    try {
                        recognition.start();
                        recognitionStartTime = Date.now();
                        // New: Reset no-speech timeout
                        noSpeechTimeout = setTimeout(() => {
                            if (isMicOn) {
                                recognition.stop();
                                addMessage("❌ No speech detected. Mic stopped.", false);
                                isMicOn = false;
                                micButton.innerHTML = "🎤";
                                micButton.style.color = "#aebac1";
                                userInput.placeholder = "Type or click mic to speak...";
                                userInput.disabled = false;
                            }
                        }, 10000);
                    } catch (e) {
                        console.log("Could not restart recognition");
                    }
                }
            }, 500);
        } else {
            if (!isSpeaking) {
                clearTimeout(noSpeechTimeout);
                micButton.innerHTML = "🎤";
                micButton.style.color = "#aebac1";
                userInput.placeholder = "Type or click mic to speak...";
                userInput.disabled = false;
            }
        }
    });

    recognition.addEventListener("error", (event) => {
        console.error("Speech recognition error:", event.error);
        if (isMicOn && event.error !== 'no-speech') { // Modified: Ignore no-speech errors handled by timeout
            addMessage(`❌ Mic error: ${event.error}`, false);
            isMicOn = false;
            clearTimeout(noSpeechTimeout);
            micButton.innerHTML = "🎤";
            micButton.style.color = "#aebac1";
            userInput.disabled = false;
        }
    });
} else {
    addMessage("❌ Speech Recognition not supported in your browser.", false);
    micButton.style.display = "none";
}

// Feature list HTML for displaying capabilities
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
✅ <strong>Habit Tracker:</strong> "Track habit: Meditation", "Show habits"<br>
✅ <strong>Expense Manager:</strong> "Add expense: 50 for food", "Show expenses"<br>
✅ <strong>Study Timer:</strong> "Start pomodoro", "25 min study timer"<br>
✅ <strong>Mood Journal:</strong> "Log mood: Happy", "Show mood history"<br>
✅ <strong>Goal Tracker:</strong> "Set goal: Learn JavaScript", "Show goals"<br>
✅ <strong>Contact Manager:</strong> "Add contact: John 1234567890", "Show contacts"<br>
✅ <strong>Password Generator:</strong> "Generate password"<br>
✅ <strong>Daily Planner:</strong> "Plan day: Study 2 hours", "Show daily plan"<br>
✅ <strong>Health Tracker:</strong> "Log water: 500ml", "Show health log"<br>
✅ <strong>Flashcard System:</strong> "Add flashcard: Capital of India - New Delhi"<br>
✅ <strong>Voice Switching:</strong> "Switch voice to David", "List voices" (availability depends on device and browser)<br>
✅ <strong>Stop:</strong> Say "Stop" to cancel anything<br><br>
Just ask me anything! 😊
`.trim();

const featureVoiceMessage = "Here are the things I can help you with!";

// General knowledge quiz questions with options and answers
const gkQuiz = [
    {
        question: "What is the capital of India?",
        options: ["A) Mumbai", "B) Kolkata", "C) New Delhi", "D) Chennai"],
        answer: "C"
    },
    {
        question: "Who is known as the Father of the Nation in India?",
        options: ["A) Jawaharlal Nehru", "B) Mahatma Gandhi", "C) Subhas Chandra Bose", "D) Sardar Patel"],
        answer: "B"
    },
];

// Quiz-related variables
let quizActive = false;
let quizScore = 0;
let quizIndex = 0;
let quizQuestions = [];
let quizTimer = null;

// Function to start quiz timer with 10 seconds limit
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

// Function to display the next quiz question
function showNextQuestion() {
    const q = quizQuestions[quizIndex];
    const optionsText = q.options.join("<br>");
    const msg = `🎯 Q${quizIndex + 1}: ${q.question}<br><br>${optionsText}`;
    setTimeout(() => {
        addMessage(msg, false);
        startQuizTimer();
    }, 500);
}

// Function to clear the quiz timer
function clearQuizTimer() {
    if (quizTimer) clearTimeout(quizTimer);
}

// Function to end the quiz and display score
function endQuiz() {
    quizActive = false;
    clearQuizTimer();
    const msg = `🎉 Quiz Completed!\nYou scored ${quizScore} out of ${quizQuestions.length}.`;
    addMessage(msg, false);
    safeSpeak(`Quiz completed! You scored ${quizScore} out of ${quizQuestions.length}.`);
}

// Rock Paper Scissors game variable
let rpsGameActive = false;

// Function to get habits from localStorage
function getHabits() {
    return JSON.parse(localStorage.getItem("ghostHabits") || "[]");
}

// Function to save habits to localStorage
function saveHabits(habits) {
    localStorage.setItem("ghostHabits", JSON.stringify(habits));
}

// Function to track a habit for today
function trackHabit(habitName) {
    const habits = getHabits();
    const today = new Date().toDateString();
    const existingHabit = habits.find(h => h.name.toLowerCase() === habitName.toLowerCase());

    if (existingHabit) {
        if (!existingHabit.dates.includes(today)) {
            existingHabit.dates.push(today);
            existingHabit.streak += 1;
        }
    } else {
        habits.push({
            name: habitName,
            dates: [today],
            streak: 1,
            createdAt: new Date().toLocaleString()
        });
    }

    saveHabits(habits);
    return `✅ Habit "${habitName}" tracked for today!`;
}

// Function to display habits in a table
function showHabits() {
    const habits = getHabits();
    if (habits.length === 0) {
        return "📋 No habits tracked yet. Use 'Track habit: Meditation' to start!";
    }

    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Habit</th>
                <th style="text-align: left;">Streak</th>
                <th style="text-align: left;">Last Done</th>
            </tr>
    `;

    habits.forEach(habit => {
        const lastDone = habit.dates.length > 0 ?
            new Date(habit.dates[habit.dates.length - 1]).toLocaleDateString() :
            "Never";
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${habit.name}</td>
                <td>${habit.streak} days</td>
                <td>${lastDone}</td>
            </tr>
        `;
    });

    table += `</table>`;
    return table;
}

// Function to get expenses from localStorage
function getExpenses() {
    return JSON.parse(localStorage.getItem("ghostExpenses") || "[]");
}

// Function to save expenses to localStorage
function saveExpenses(expenses) {
    localStorage.setItem("ghostExpenses", JSON.stringify(expenses));
}

// Function to add an expense entry
function addExpense(amount, description) {
    const expenses = getExpenses();
    const expense = {
        amount: parseFloat(amount),
        description: description,
        date: new Date().toLocaleString()
    };
    expenses.push(expense);
    saveExpenses(expenses);

    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    return `✅ Expense added: ₹${amount} for ${description}<br>📊 Total spent: ₹${total.toFixed(2)}`;
}

// Function to display expenses in a table
function showExpenses() {
    const expenses = getExpenses();
    if (expenses.length === 0) {
        return "💰 No expenses recorded yet. Use 'Add expense: 50 for food' to start!";
    }

    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Amount</th>
                <th style="text-align: left;">Description</th>
                <th style="text-align: left;">Date</th>
            </tr>
    `;

    let total = 0;
    expenses.forEach(expense => {
        total += expense.amount;
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>₹${expense.amount.toFixed(2)}</td>
                <td>${expense.description}</td>
                <td>${expense.date}</td>
            </tr>
        `;
    });

    table += `
        <tr style="background: #2d2d2d; color: white; font-weight: bold;">
            <td colspan="2">Total:</td>
            <td>₹${total.toFixed(2)}</td>
        </tr>
    `;
    table += `</table>`;
    return table;
}

// Pomodoro timer variables
let pomodoroTimer = null;
let pomodoroTimeLeft = 0;

// Function to start a pomodoro study timer
function startPomodoro(minutes = 25) {
    if (pomodoroTimer) {
        clearTimeout(pomodoroTimer);
    }

    pomodoroTimeLeft = minutes * 60;
    const endTime = new Date(Date.now() + pomodoroTimeLeft * 1000);

    function updateTimer() {
        if (pomodoroTimeLeft <= 0) {
            addMessage("⏰ Pomodoro session completed! Time for a break!", false);
            if (Notification.permission === "granted") {
                new Notification("Ghost - Pomodoro", { body: "Pomodoro session completed! Time for a break!" });
            }
            pomodoroTimer = null;
            return;
        }

        pomodoroTimeLeft--;
        setTimeout(updateTimer, 1000);
    }

    pomodoroTimer = setTimeout(updateTimer, 1000);
    return `⏱️ Pomodoro timer started for ${minutes} minutes!`;
}

// Function to get mood logs from localStorage
function getMoods() {
    return JSON.parse(localStorage.getItem("ghostMoods") || "[]");
}

// Function to save mood logs to localStorage
function saveMoods(moods) {
    localStorage.setItem("ghostMoods", JSON.stringify(moods));
}

// Function to log a mood entry
function logMood(mood) {
    const moods = getMoods();
    const moodEntry = {
        mood: mood,
        date: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    moods.push(moodEntry);
    saveMoods(moods);
    return `😊 Mood "${mood}" logged successfully!`;
}

// Function to display mood history in a table
function showMoodHistory() {
    const moods = getMoods();
    if (moods.length === 0) {
        return "🎭 No moods logged yet. Use 'Log mood: Happy' to start!";
    }

    moods.sort((a, b) => b.timestamp - a.timestamp);

    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Mood</th>
                <th style="text-align: left;">Date</th>
            </tr>
    `;

    moods.forEach(mood => {
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${mood.mood}</td>
                <td>${mood.date}</td>
            </tr>
        `;
    });

    table += `</table>`;
    return table;
}

// Function to get goals from localStorage
function getGoals() {
    return JSON.parse(localStorage.getItem("ghostGoals") || "[]");
}

// Function to save goals to localStorage
function saveGoals(goals) {
    localStorage.setItem("ghostGoals", JSON.stringify(goals));
}

// Function to set a new goal
function setGoal(goalText) {
    const goals = getGoals();
    const goal = {
        id: Date.now(),
        text: goalText,
        status: "pending",
        createdAt: new Date().toLocaleString()
    };
    goals.push(goal);
    saveGoals(goals);
    return `🎯 Goal set: "${goalText}"`;
}

// Function to display goals in a table
function showGoals() {
    const goals = getGoals();
    if (goals.length === 0) {
        return "🎯 No goals set yet. Use 'Set goal: Learn JavaScript' to start!";
    }

    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Goal</th>
                <th style="text-align: left;">Status</th>
                <th style="text-align: left;">Created</th>
            </tr>
    `;

    goals.forEach(goal => {
        const status = goal.status === "completed" ? "✅ Completed" : "⏳ Pending";
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${goal.text}</td>
                <td>${status}</td>
                <td>${goal.createdAt}</td>
            </tr>
        `;
    });

    table += `</table>`;
    return table;
}

// Function to get contacts from localStorage
function getContacts() {
    return JSON.parse(localStorage.getItem("ghostContacts") || "[]");
}

// Function to save contacts to localStorage
function saveContacts(contacts) {
    localStorage.setItem("ghostContacts", JSON.stringify(contacts));
}

// Function to add a contact
function addContact(name, phone) {
    const contacts = getContacts();
    const contact = {
        name: name,
        phone: phone,
        createdAt: new Date().toLocaleString()
    };
    contacts.push(contact);
    saveContacts(contacts);
    return `📞 Contact added: ${name} - ${phone}`;
}

// Function to display contacts in a table
function showContacts() {
    const contacts = getContacts();
    if (contacts.length === 0) {
        return "📞 No contacts saved yet. Use 'Add contact: John 1234567890' to start!";
    }

    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Name</th>
                <th style="text-align: left;">Phone</th>
                <th style="text-align: left;">Added</th>
            </tr>
    `;

    contacts.forEach(contact => {
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${contact.name}</td>
                <td>${contact.phone}</td>
                <td>${contact.createdAt}</td>
            </tr>
        `;
    });

    table += `</table>`;
    return table;
}

// Function to generate a random password
function generatePassword(length = 12) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `🔑 Generated password: <strong>${password}</strong><br>📋 Copy and save it securely!`;
}

// Function to get daily plan from localStorage
function getDailyPlan() {
    return JSON.parse(localStorage.getItem("ghostDailyPlan") || "[]");
}

// Function to save daily plan to localStorage
function saveDailyPlan(plan) {
    localStorage.setItem("ghostDailyPlan", JSON.stringify(plan));
}

// Function to add a daily plan item
function addPlanItem(item) {
    const plan = getDailyPlan();
    const planItem = {
        text: item,
        completed: false,
        createdAt: new Date().toLocaleString()
    };
    plan.push(planItem);
    saveDailyPlan(plan);
    return `📅 Plan item added: "${item}"`;
}

// Function to display daily plan in a table
function showDailyPlan() {
    const plan = getDailyPlan();
    if (plan.length === 0) {
        return "📅 No daily plan yet. Use 'Plan day: Study 2 hours' to start!";
    }

    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Task</th>
                <th style="text-align: left;">Status</th>
                <th style="text-align: left;">Added</th>
            </tr>
    `;

    plan.forEach(item => {
        const status = item.completed ? "✅ Done" : "⏳ Pending";
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${item.text}</td>
                <td>${status}</td>
                <td>${item.createdAt}</td>
            </tr>
        `;
    });

    table += `</table>`;
    return table;
}

// Function to get health logs from localStorage
function getHealthLogs() {
    return JSON.parse(localStorage.getItem("ghostHealthLogs") || "[]");
}

// Function to save health logs to localStorage
function saveHealthLogs(logs) {
    localStorage.setItem("ghostHealthLogs", JSON.stringify(logs));
}

// Function to log a health activity
function logHealth(activity, amount) {
    const logs = getHealthLogs();
    const log = {
        activity: activity,
        amount: amount,
        date: new Date().toLocaleString()
    };
    logs.push(log);
    saveHealthLogs(logs);
    return `💪 Health log added: ${activity} - ${amount}`;
}

// Function to display health logs in a table
function showHealthLogs() {
    const logs = getHealthLogs();
    if (logs.length === 0) {
        return "💪 No health logs yet. Use 'Log water: 500ml' to start!";
    }

    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Activity</th>
                <th style="text-align: left;">Amount</th>
                <th style="text-align: left;">Date</th>
            </tr>
    `;

    logs.forEach(log => {
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${log.activity}</td>
                <td>${log.amount}</td>
                <td>${log.date}</td>
            </tr>
        `;
    });

    table += `</table>`;
    return table;
}

// Function to get flashcards from localStorage
function getFlashcards() {
    return JSON.parse(localStorage.getItem("ghostFlashcards") || "[]");
}

// Function to save flashcards to localStorage
function saveFlashcards(flashcards) {
    localStorage.setItem("ghostFlashcards", JSON.stringify(flashcards));
}

// Function to add a flashcard
function addFlashcard(question, answer) {
    const flashcards = getFlashcards();
    const flashcard = {
        question: question,
        answer: answer,
        createdAt: new Date().toLocaleString()
    };
    flashcards.push(flashcard);
    saveFlashcards(flashcards);
    return `📚 Flashcard added!<br>❓ ${question}<br>✅ ${answer}`;
}

// Function to display flashcards
function showFlashcards() {
    const flashcards = getFlashcards();
    if (flashcards.length === 0) {
        return "📚 No flashcards yet. Use 'Add flashcard: Capital of India - New Delhi' to start!";
    }

    let cards = "📚 Your Flashcards:<br><br>";
    flashcards.forEach((card, index) => {
        cards += `
            <div style="background: #2d2d2d; padding: 10px; margin: 10px 0; border-radius: 5px;">
                <strong>Card ${index + 1}:</strong><br>
                ❓ <strong>Q:</strong> ${card.question}<br>
                ✅ <strong>A:</strong> ${card.answer}<br>
                <small>Added: ${card.createdAt}</small>
            </div>
        `;
    });

    return cards;
}

// Daily conversation triggers
const dailyConversations = {
    greetings: [
        "hi", "hello", "hey", "hlo", "namaste", "good morning", "good afternoon",
        "good evening", "sup", "whats up", "howdy", "greetings"
    ],
    howAreYou: [
        "how are you", "how r u", "how are u", "kaise ho", "how are you doing",
        "how you doing", "are you fine", "are you okay"
    ],
    myName: [
        "my name", "who am i", "what is my name", "do you know my name"
    ],
    yourName: [
        "your name", "what is your name", "who are you", "what are you"
    ],
    owner: [
        "your owner", "who made you", "who created you", "who built you",
        "who developed you", "who programmed you"
    ],
    time: [
        "time", "what time", "current time", "tell me time"
    ],
    date: [
        "date", "today", "what date", "current date", "what is today"
    ],
    help: [
        "what can you do", "help", "features", "what can you do", "show features",
        "what are your features", "capabilities", "what can you help me with"
    ],
    stop: [
        "stop", "shut up", "cancel", "quiet", "stop talking", "be quiet", "silence"
    ],
    clear: [
        "clear chat", "clear history", "delete chat", "reset chat"
    ]
};

// Core function to generate response based on user message
function getResponse(message) {
    const lower = message.toLowerCase().trim();
    const words = lower.split(/\s+/);

    if (awaitingTaskInput) {
        awaitingTaskInput = false;
        const task = message.trim();
        if (!task) return "❌ Please provide a task to add.";

        const tasks = getTasks();
        tasks.push({ text: task, time: new Date().toLocaleString() });
        saveTasks(tasks);
        return `✅ Task added: "${task}"`;
    }

    if (awaitingReminderInput) {
        awaitingReminderInput = false;
        awaitingReminderTime = true;
        tempReminderText = message.trim();
        return `⏰ "${tempReminderText}" When To Remind You? (Example: 5 minutes, 1 hour, tomorrow)`;
    }

    if (awaitingReminderTime) {
        awaitingReminderTime = false;
        const timeText = message.trim();

        let ms = 0;
        let displayTime = "";

        if (timeText.includes("minute") || timeText.includes("min")) {
            const match = timeText.match(/(\d+)/);
            if (match) {
                const minutes = parseInt(match[1]);
                ms = minutes * 60000;
                displayTime = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
            }
        } else if (timeText.includes("hour")) {
            const match = timeText.match(/(\d+)/);
            if (match) {
                const hours = parseInt(match[1]);
                ms = hours * 3600000;
                displayTime = `${hours} hour${hours !== 1 ? 's' : ''}`;
            }
        } else if (timeText.includes("second") || timeText.includes("sec")) {
            const match = timeText.match(/(\d+)/);
            if (match) {
                const seconds = parseInt(match[1]);
                ms = seconds * 1000;
                displayTime = `${seconds} second${seconds !== 1 ? 's' : ''}`;
            }
        } else {
            ms = 300000;
            displayTime = "5 minutes";
        }

        if (ms > 0) {
            const timerId = setTimeout(() => {
                const notificationMsg = `🔔 Reminder: ${tempReminderText}`;
                addMessage(notificationMsg, false);
                if (voiceEnabled) {
                    speak(notificationMsg);
                }
                if (Notification.permission === "granted") {
                    new Notification("Ghost Reminder", { body: tempReminderText });
                }
            }, ms);

            activeReminders.push(timerId);
            const finalText = tempReminderText;
            tempReminderText = "";
            return `✅ I'll remind you "${finalText}" in ${displayTime}.`;
        } else {
            tempReminderText = "";
            return "❌ Invalid time format. Please try again.";
        }
    }

    if (dailyConversations.stop.some(cmd => lower.includes(cmd))) {
        synth.cancel();
        isSpeaking = false;
        return "Okay, I'm stopping right away. 😶";
    }

    if (dailyConversations.clear.some(cmd => lower.includes(cmd))) {
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

    if (dailyConversations.help.some(cmd => lower.includes(cmd))) {
        addMessage(featureList, false);
        safeSpeak(featureVoiceMessage);
        return;
    }

    // Voice switching command
    if (lower.includes("switch voice to")) {
        const voiceMatch = lower.match(/switch voice to (.+)/);
        if (voiceMatch) {
            const requestedVoice = voiceMatch[1].trim();
            switchVoice(requestedVoice);
            return;
        }
    }

    if (lower.includes("list voices")) {
        return listVoices();
    }

    if (lower.includes("track habit") || lower.includes("log habit")) {
        const habitMatch = message.match(/(?:track|log) habit:?\s*(.+)/i);
        if (habitMatch && habitMatch[1]) {
            return trackHabit(habitMatch[1].trim());
        } else {
            return "❌ Please specify habit name. Example: 'Track habit: Meditation'";
        }
    }

    if (lower.includes("show habits") || lower.includes("view habits") || lower.includes("my habits")) {
        return showHabits();
    }

    if (lower.includes("add expense") || lower.includes("log expense")) {
        const expenseMatch = message.match(/(?:add|log) expense:?\s*(\d+(?:\.\d+)?)\s*(?:for|on)?\s*(.+)/i);
        if (expenseMatch && expenseMatch[1] && expenseMatch[2]) {
            return addExpense(expenseMatch[1], expenseMatch[2]);
        } else {
            return "❌ Please specify amount and description. Example: 'Add expense: 50 for food'";
        }
    }

    if (lower.includes("show expenses") || lower.includes("view expenses") || lower.includes("my expenses")) {
        return showExpenses();
    }

    if (lower.includes("start pomodoro") || lower.includes("pomodoro timer")) {
        const timeMatch = message.match(/(\d+)\s*(?:min|minute|minutes)/i);
        const minutes = timeMatch ? parseInt(timeMatch[1]) : 25;
        return startPomodoro(minutes);
    }

    if (lower.includes("study timer") || lower.includes("focus timer")) {
        const timeMatch = message.match(/(\d+)\s*(?:min|minute|minutes)/i);
        const minutes = timeMatch ? parseInt(timeMatch[1]) : 25;
        return startPomodoro(minutes);
    }

    if (lower.includes("log mood") || lower.includes("track mood")) {
        const moodMatch = message.match(/(?:log|track) mood:?\s*(.+)/i);
        if (moodMatch && moodMatch[1]) {
            return logMood(moodMatch[1].trim());
        } else {
            return "❌ Please specify your mood. Example: 'Log mood: Happy'";
        }
    }

    if (lower.includes("show mood") || lower.includes("view mood") || lower.includes("mood history")) {
        return showMoodHistory();
    }

    if (lower.includes("set goal") || lower.includes("add goal")) {
        const goalMatch = message.match(/(?:set|add) goal:?\s*(.+)/i);
        if (goalMatch && goalMatch[1]) {
            return setGoal(goalMatch[1].trim());
        } else {
            return "❌ Please specify your goal. Example: 'Set goal: Learn JavaScript'";
        }
    }

    if (lower.includes("show goals") || lower.includes("view goals") || lower.includes("my goals")) {
        return showGoals();
    }

    if (lower.includes("add contact")) {
        const contactMatch = message.match(/add contact:?\s*(.+?)\s+(\d+)/i);
        if (contactMatch && contactMatch[1] && contactMatch[2]) {
            return addContact(contactMatch[1], contactMatch[2]);
        } else {
            return "❌ Please specify name and phone. Example: 'Add contact: John 1234567890'";
        }
    }

    if (lower.includes("show contacts") || lower.includes("view contacts") || lower.includes("my contacts")) {
        return showContacts();
    }

    if (lower.includes("generate password") || lower.includes("create password")) {
        return generatePassword();
    }

    if (lower.includes("plan day") || lower.includes("add plan")) {
        const planMatch = message.match(/(?:plan day|add plan):?\s*(.+)/i);
        if (planMatch && planMatch[1]) {
            return addPlanItem(planMatch[1].trim());
        } else {
            return "❌ Please specify plan item. Example: 'Plan day: Study 2 hours'";
        }
    }

    if (lower.includes("show plan") || lower.includes("view plan") || lower.includes("daily plan")) {
        return showDailyPlan();
    }

    if (lower.includes("log water") || lower.includes("log health")) {
        const healthMatch = message.match(/(?:log water|log health):?\s*(.+)/i);
        if (healthMatch && healthMatch[1]) {
            return logHealth("Water", healthMatch[1].trim());
        } else {
            return "❌ Please specify amount. Example: 'Log water: 500ml'";
        }
    }

    if (lower.includes("show health") || lower.includes("view health") || lower.includes("health log")) {
        return showHealthLogs();
    }

    if (lower.includes("add flashcard")) {
        const flashcardMatch = message.match(/add flashcard:?\s*(.+?)\s*[-–—]\s*(.+)/i);
        if (flashcardMatch && flashcardMatch[1] && flashcardMatch[2]) {
            return addFlashcard(flashcardMatch[1].trim(), flashcardMatch[2].trim());
        } else {
            return "❌ Please specify question and answer. Example: 'Add flashcard: Capital of India - New Delhi'";
        }
    }

    if (lower.includes("show flashcards") || lower.includes("view flashcards") || lower.includes("my flashcards")) {
        return showFlashcards();
    }

    const quizTriggers = [
        "let's play quiz", "play quiz", "start quiz", "quiz time", "quiz",
        "i want to play quiz", "take a quiz", "give me a quiz"
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

    if (["exit quiz", "stop quiz", "quit quiz", "end quiz", "leave quiz", "Exit"].includes(lower)) {
        if (quizActive) {
            quizActive = false;
            clearQuizTimer();
            return "👋 Quiz exited. You can start again anytime!";
        } else {
            return "No quiz is active right now.";
        }
    }

    if (quizActive) {
        const ans = message.trim().toUpperCase();
        const correct = quizQuestions[quizIndex].answer;

        clearQuizTimer();

        const isCorrect =
            ans === correct ||
            ans === (correct.charCodeAt(0) - 64).toString();

        if (isCorrect) {
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

    const rpsTriggers = [
        "rps", "rock paper scissors", "play rps", "lets play game", "game",
        "play game", "lets play rps", "play rock paper scissors"
    ];
    if (rpsTriggers.some(trigger => lower === trigger)) {
        rpsGameActive = true;
        return "🎮 Let's play Rock-Paper-Scissors!<br>Choose: <strong>Rock</strong>, <strong>Paper</strong>, or <strong>Scissors</strong>.";
    }

    if (rpsGameActive) {
        const userChoice = lower.trim();
        const choices = ["rock", "paper", "scissors"];
        const botChoice = choices[Math.floor(Math.random() * 3)];

        if (!["rock", "paper", "scissors"].includes(userChoice)) {
            return "❌ Invalid choice! Choose: Rock, Paper, or Scissors.";
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

    if (dailyConversations.greetings.some(g => lower.includes(g))) {
        const greetings = [
            "Hi there! I'm Ghost, your AI assistant. How can I help you today?",
            "Hello! I'm Ghost. What can I do for you?",
            "Hey! I'm Ghost. How can I assist you?",
            "Greetings! I'm Ghost. What would you like to know?"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    if (dailyConversations.howAreYou.some(q => lower.includes(q))) {
        const responses = [
            "I'm doing great, thanks! How about you?",
            "I'm fine, thank you! How are you doing?",
            "I'm good! Hope you're having a great day!",
            "Doing well! Thanks for asking. How are you?"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    if (dailyConversations.yourName.some(q => lower.includes(q))) {
        return "I'm Ghost — your ai companion! ";
    }

    if (dailyConversations.owner.some(q => lower.includes(q))) {
        return "I'm Ghost — Made By Arpit Pandey!";
    }

    if (dailyConversations.myName.some(q => lower.includes(q))) {
        return "Your Name Is Arpit";
    }

    if (dailyConversations.time.some(q => lower.includes(q))) {
        return `The current time is ${new Date().toLocaleTimeString()}.`;
    }

    if (dailyConversations.date.some(q => lower.includes(q))) {
        return `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    }

    if (lower.includes("what is") || lower.includes("solve") || lower.includes("calculate") || lower.includes("=")) {
        const mathRegex = /^([+\-]?(?:\d+\.?\d*|\.\d+)(?:[+\-*/](?:\d+\.?\d*|\.\d+))*)$/;
        const cleanExpr = message.replace(/what is|solve|calculate|=/gi, "").trim();
        if (mathRegex.test(cleanExpr)) {
            try {
                let expr = cleanExpr.replace(/x/g, '*');
                if (/[^0-9+\-*/().\s]/.test(expr)) {
                    return "❌ Invalid characters in math expression.";
                }
                const result = Function('"use strict"; return (' + expr + ')')();
                if (isNaN(result) || !isFinite(result)) {
                    return "❌ Cannot calculate this expression.";
                }
                return `🧮 Result: ${cleanExpr} = ${result}`;
            } catch (e) {
                return "❌ I couldn't solve this math problem.";
            }
        }
    }

    if (lower.includes("remind me") || lower.includes("set reminder") || lower.includes("alert me in") || lower.includes("notify me") || lower.includes("add reminder")) {
        const remindMatch1 = lower.match(/remind me to (.+?) in (\d+) (seconds?|minutes?|hours?)/);
        const remindMatch2 = lower.match(/set a reminder for (\d+) (seconds?|minutes?|hours?)(?: to (.+?))?$/);
        const remindMatch3 = lower.match(/in (\d+) (seconds?|minutes?) remind me to (.+?)(?:$|\.)/);

        if (remindMatch1 || remindMatch2 || remindMatch3) {
            let task, timeValue, unit;

            if (remindMatch1) {
                [_, task, timeValue, unit] = remindMatch1;
            } else if (remindMatch2) {
                [_, timeValue, unit, task] = remindMatch2;
            } else if (remindMatch3) {
                [_, timeValue, unit, task] = remindMatch3;
            }

            task = task?.trim() || null;
            if (!task) {
                awaitingReminderInput = true;
                return "🔔 For What you'd like to set a reminder ?";
            }

            const value = parseInt(timeValue);
            let ms;

            if (unit.startsWith("sec")) ms = value * 1000;
            else if (unit.startsWith("min")) ms = value * 60000;
            else if (unit.startsWith("hour")) ms = value * 3600000;

            const timerId = setTimeout(() => {
                const notificationMsg = `🔔 Reminder: ${task}`;
                addMessage(notificationMsg, false);
                if (voiceEnabled) {
                    speak(notificationMsg);
                }
                if (Notification.permission === "granted") {
                    new Notification("Ghost Reminder", { body: task });
                }
            }, ms);

            activeReminders.push(timerId);

            const displayUnit = unit.startsWith("hour") ? "hour" : unit;
            return `✅ I'll remind you to "${task}" in ${value} ${displayUnit}${value !== 1 ? 's' : ''}.`;
        }

        awaitingReminderInput = true;
        return "🔔 What is the reminder you'd like to set?";
    }

    if (lower.startsWith("add:") ||
        lower.includes("add task") ||
        lower.includes("add another") ||
        lower.includes("create task") ||
        lower.includes("add new task") ||
        lower.includes("create new task") ||
        lower.includes("make a task") ||
        lower.includes("add a task")) {
        const taskMatch = message.match(/(?:add task|create task|add new task|create new task|make a task|add a task| add another):?\s*(.+)/i) ||
            message.match(/add:(.+)/i);
        let task = taskMatch ? taskMatch[1].trim() :
            message.replace(/add task|create task|add new task|create new task|make a task|add another|add a task/gi, "").trim();

        if (!task || lower.trim() === "add task" || lower.trim() === "add another" || lower.trim() === "add a task") {
            awaitingTaskInput = true;
            return "📝 What task should I add?";
        }

        const tasks = getTasks();
        tasks.push({ text: task, time: new Date().toLocaleString() });
        saveTasks(tasks);
        return `✅ Task added: "${task}"`;
    }

    if (lower.includes("show tasks") ||
        lower.includes("my tasks") ||
        lower.includes("todo") ||
        lower.includes("list tasks") ||
        lower.includes("view tasks")) {
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

    if (lower.startsWith("note:") ||
        lower.startsWith("save:") ||
        lower.includes("save note") ||
        lower.includes("add note") ||
        lower.includes("create note")) {
        const note = message.slice(message.indexOf(":") + 1).trim() ||
            message.replace(/save note|add note|create note/gi, "").trim();
        const notes = JSON.parse(localStorage.getItem("ghostNotes") || "[]");
        notes.push({ text: note, time: new Date().toLocaleString() });
        localStorage.setItem("ghostNotes", JSON.stringify(notes));
        return `📝 Note saved: "${note}"`;
    }

    if (lower.includes("my notes") ||
        lower.includes("saved notes") ||
        lower.includes("view notes") ||
        lower.includes("show notes")) {
        const notes = JSON.parse(localStorage.getItem("ghostNotes") || "[]");
        if (notes.length === 0) return "You have no notes yet. Use 'note: your text' to save one!";
        return "📒 Your notes:<br>" + notes.map(n => `• "${n.text}" <small>(${n.time})</small>`).join("<br>");
    }

    if (lower.includes("weight") && lower.includes("height") || lower.includes("bmi") || lower.includes("body mass index")) {
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

    if (lower.includes("play") && (lower.includes("youtube") || lower.includes("song") || lower.includes("music") || lower.includes("listen to"))) {
        const queryMatch = message.match(/play (.+?) on youtube/i);
        const songName = queryMatch ? queryMatch[1] : message.replace(/play|song|music|listen to|on youtube/gi, "").trim();

        if (songName.trim()) {
            setTimeout(() => playOnYouTube(songName), 500);
            return `🎵 Playing "${songName}" on YouTube...`;
        }
    }

    const defaultResponses = [
        "I'm here to help! Try asking 'what can you do' to see my features.",
        "I can help you with many things! Ask me about math, time, tasks, or just chat!",
        "I'm your AI assistant! What would you like to know?",
        "I'm ready to help! Try asking me to calculate something or set a reminder."
    ];

    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// Function to send user message and get response
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
    }, 300 + Math.random() * 200);
}

// Voice toggle variables and functions
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

// Modified: Enhanced safeSpeak for mobile compatibility
function safeSpeak(text) {
    if (voiceEnabled && text) {
        // Force voice loading for mobile browsers
        synth.getVoices();
        const voices = synth.getVoices();
        if (voices.length === 0) {
            console.warn("No voices loaded yet, retrying...");
            // New: Increased retry delay for mobile devices
            setTimeout(() => safeSpeak(text), 1000);
            return;
        }
        if (!getPreferredVoice()) {
            console.error("No voices available after retries.");
            addMessage("❌ No voices available for speech output.", false);
            return;
        }
        console.log("Speaking text:", text); // New: Debug log for voice output
        speak(text);
    }
}

updateVoiceButton();

// Event listeners for send button and enter key
sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

// Request notification permission if available
if ("Notification" in window) {
    Notification.requestPermission();
}

// Load voices and history on first interaction
document.addEventListener("click", () => {
    if (synth.getVoices().length === 0) {
        synth.getVoices();
    }

    if (!window.chatHistoryLoaded) {
        loadChatHistory();
        window.chatHistoryLoaded = true;

        if (chatArea.children.length <= 1) {
            const welcomeMsg = "Hello! I'm Ghost, How can I help you today?";
            addMessage(welcomeMsg, false);
        }
    }
}, { once: true });

// Hide typing indicator initially
hideTyping();

// Function to adjust app height for mobile devices
(function () {
    function setAppHeight() {
        document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    }
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
})();

// Placeholder for playOnYouTube function
function playOnYouTube(songName) {
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`, '_blank');
}

// Placeholder for playCorrectSound and playWrongSound
function playCorrectSound() {
    // Play correct answer sound
}

function playWrongSound() {
    // Play wrong answer sound
}

// Function to get tasks from localStorage
function getTasks() {
    return JSON.parse(localStorage.getItem("ghostTasks") || "[]");
}

// Function to save tasks to localStorage
function saveTasks(tasks) {
    localStorage.setItem("ghostTasks", JSON.stringify(tasks));
}

// Active reminders array
let activeReminders = [];