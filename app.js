// --- APPLICATION STATE ---
let state = {
    currentUser: null,
    activeTab: 'summary',
    onboardingStep: 1,
    selectedGrade: 'Middle School',
    selectedPrefTime: 'Morning',
    selectedAvatar: '1',
    selectedSubjects: ['Mathematics', 'Physics', 'Chemistry'],
    timerInterval: null,
    timerSeconds: 1500, // Default 25 min
    timerMode: 'work', // work, short, long
    timerIsRunning: false,
    timetableSlots: [], // list of classes: { id, name, day, start, end, location, color }
    studyPlans: [] // list of plans: { id, subject, examTitle, examDate, confidence, pace, color, tasks: [{ id, text, duration, completed }] }
};

// Avatar URL Map
const AVATAR_MAP = {
    '1': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
    '2': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=150',
    '3': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
    '4': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150'
};

// --- INITIALIZE APPLICATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Seed default test student account
    seedDefaultUser();

    // Initializing Lucide Icons
    lucide.createIcons();
    
    // Check if user is already logged in
    const cachedUser = localStorage.getItem('aether_current_user');
    if (cachedUser) {
        loadUserSession(cachedUser);
    } else {
        showView('auth-view');
    }

    // Setup interactive onboarding events
    initOnboardingSelectors();
    
    // Setup color selectors
    initColorSelectors();
});

function seedDefaultUser() {
    let db = JSON.parse(localStorage.getItem('aether_users_db')) || [];
    const defaultEmail = 'student@aether.edu';
    
    if (!db.some(u => u.email === defaultEmail)) {
        const defaultUser = {
            email: defaultEmail,
            password: 'password123',
            name: 'Tim Harrison',
            onboarded: true,
            profile: {
                avatar: '1',
                grade: 'High School',
                subjects: ['Mathematics', 'Science', 'English', 'Sinhala', 'History', 'ICT'],
                targetHours: 18,
                prefTime: 'Evening'
            },
            timetable: [
                { id: 'seed-t1', name: 'Mathematics', day: 'Monday', start: '16:00', end: '17:00', location: 'OL Class', color: 'purple' },
                { id: 'seed-t2', name: 'Science', day: 'Monday', start: '17:00', end: '18:00', location: 'OL Class', color: 'cyan' },
                { id: 'seed-t3', name: 'English', day: 'Monday', start: '19:00', end: '20:00', location: 'OL Class', color: 'emerald' }
            ],
            studyPlans: []
        };
        db.push(defaultUser);
        localStorage.setItem('aether_users_db', JSON.stringify(db));
    }
}

// --- AUTHENTICATION & SESSION CONTROLLER ---
window.switchAuthMode = function(mode) {
    const loginTab = document.getElementById('tab-login');
    const signupTab = document.getElementById('tab-signup');
    const signupFields = document.getElementById('signup-fields');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleMsg = document.getElementById('auth-toggle-msg');
    
    // Reset inputs
    document.getElementById('auth-form').reset();

    if (mode === 'signup') {
        loginTab.classList.remove('active');
        signupTab.classList.add('active');
        signupFields.classList.remove('hidden');
        submitBtn.querySelector('span').textContent = 'Create Account';
        toggleMsg.textContent = 'Already have an account? Click "Sign In" above to access your hub.';
    } else {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        signupFields.classList.add('hidden');
        submitBtn.querySelector('span').textContent = 'Sign In';
        toggleMsg.textContent = 'New to Aether? Click "Create Account" above to start.';
    }
};

window.handleAuthSubmit = function(event) {
    event.preventDefault();
    
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value.trim();
    const isSignUp = document.getElementById('tab-signup').classList.contains('active');

    let db = JSON.parse(localStorage.getItem('aether_users_db')) || [];

    if (isSignUp) {
        // Register new user
        if (db.some(u => u.email === email)) {
            alert('An account with this email address already exists.');
            return;
        }

        const newUser = {
            email,
            password,
            name: name || email.split('@')[0],
            onboarded: false,
            profile: {
                avatar: '1',
                grade: 'Middle School',
                subjects: ['Mathematics', 'Physics', 'Chemistry'],
                targetHours: 15,
                prefTime: 'Morning'
            },
            timetable: [],
            studyPlans: []
        };

        db.push(newUser);
        localStorage.setItem('aether_users_db', JSON.stringify(db));
        
        // Log in the user
        localStorage.setItem('aether_current_user', email);
        loadUserSession(email);
    } else {
        // Log in existing user
        const matchedUser = db.find(u => u.email === email && u.password === password);
        if (matchedUser) {
            localStorage.setItem('aether_current_user', email);
            loadUserSession(email);
        } else {
            alert('Invalid email or password. Please try again.');
        }
    }
};

function loadUserSession(email) {
    const db = JSON.parse(localStorage.getItem('aether_users_db')) || [];
    const user = db.find(u => u.email === email);
    
    if (!user) {
        localStorage.removeItem('aether_current_user');
        showView('auth-view');
        return;
    }

    state.currentUser = user;
    state.timetableSlots = user.timetable || [];
    state.studyPlans = user.studyPlans || [];

    // Redirect to onboarding or dashboard
    if (!user.onboarded) {
        startOnboarding();
    } else {
        loadDashboard();
    }
}

window.handleLogout = function() {
    localStorage.removeItem('aether_current_user');
    state.currentUser = null;
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerIsRunning = false;
    showView('auth-view');
};

function saveUserData() {
    if (!state.currentUser) return;

    let db = JSON.parse(localStorage.getItem('aether_users_db')) || [];
    const index = db.findIndex(u => u.email === state.currentUser.email);
    
    if (index !== -1) {
        state.currentUser.timetable = state.timetableSlots;
        state.currentUser.studyPlans = state.studyPlans;
        db[index] = state.currentUser;
        localStorage.setItem('aether_users_db', JSON.stringify(db));
    }
}

// --- VIEW NAVIGATION SYSTEM ---
function showView(viewId) {
    const views = ['auth-view', 'onboarding-view', 'dashboard-view'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (v === viewId) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

// --- ONBOARDING CONTROLLER ---
function startOnboarding() {
    state.onboardingStep = 1;
    updateOnboardingUI();
    showView('onboarding-view');
}

function initOnboardingSelectors() {
    // Step 1: Grade Selectors
    const gradeSelectors = document.querySelectorAll('#onboarding-step-1 .card-selector');
    gradeSelectors.forEach(sel => {
        sel.addEventListener('click', () => {
            gradeSelectors.forEach(s => s.classList.remove('selected'));
            sel.classList.add('selected');
            state.selectedGrade = sel.dataset.grade;
        });
    });

    // Step 1: Avatar Selectors
    const avatarOpts = document.querySelectorAll('#onboarding-step-1 .avatar-opt');
    avatarOpts.forEach(opt => {
        opt.addEventListener('click', () => {
            avatarOpts.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            state.selectedAvatar = opt.dataset.avatar;
        });
    });

    // Step 2: Subject Tag Pills
    const tagPills = document.querySelectorAll('#subject-tags .tag-pill');
    tagPills.forEach(pill => {
        pill.addEventListener('click', () => {
            pill.classList.toggle('selected');
            const sub = pill.dataset.subject;
            if (pill.classList.contains('selected')) {
                if (!state.selectedSubjects.includes(sub)) state.selectedSubjects.push(sub);
            } else {
                state.selectedSubjects = state.selectedSubjects.filter(s => s !== sub);
            }
        });
    });

    // Step 3: Preferred Time Selectors
    const timeSelectors = document.querySelectorAll('#onboarding-step-3 .card-selector');
    timeSelectors.forEach(sel => {
        sel.addEventListener('click', () => {
            timeSelectors.forEach(s => s.classList.remove('selected'));
            sel.classList.add('selected');
            state.selectedPrefTime = sel.dataset.prefTime;
        });
    });
}

window.addCustomSubject = function() {
    const input = document.getElementById('custom-subject-input');
    const val = input.value.trim();
    if (!val) return;

    if (state.selectedSubjects.includes(val)) {
        alert('Subject already added!');
        return;
    }

    state.selectedSubjects.push(val);

    // Create and append tag pill
    const container = document.getElementById('subject-tags');
    const pill = document.createElement('div');
    pill.className = 'tag-pill selected';
    pill.dataset.subject = val;
    pill.textContent = val;
    pill.addEventListener('click', () => {
        pill.classList.toggle('selected');
        if (pill.classList.contains('selected')) {
            if (!state.selectedSubjects.includes(val)) state.selectedSubjects.push(val);
        } else {
            state.selectedSubjects = state.selectedSubjects.filter(s => s !== val);
        }
    });

    container.appendChild(pill);
    input.value = '';
};

window.nextOnboardingStep = function() {
    if (state.onboardingStep === 1) {
        state.onboardingStep = 2;
        updateOnboardingUI();
    } else if (state.onboardingStep === 2) {
        if (state.selectedSubjects.length === 0) {
            alert('Please select or add at least one subject to study.');
            return;
        }
        state.onboardingStep = 3;
        updateOnboardingUI();
    } else if (state.onboardingStep === 3) {
        // Complete onboarding
        const hrs = parseInt(document.getElementById('pref-hours').value) || 15;
        state.currentUser.profile = {
            avatar: state.selectedAvatar,
            grade: state.selectedGrade,
            subjects: state.selectedSubjects,
            targetHours: hrs,
            prefTime: state.selectedPrefTime
        };
        state.currentUser.onboarded = true;
        
        saveUserData();
        loadDashboard();
    }
};

window.prevOnboardingStep = function() {
    if (state.onboardingStep > 1) {
        state.onboardingStep--;
        updateOnboardingUI();
    }
};

function updateOnboardingUI() {
    // Update step containers
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`onboarding-step-${i}`);
        if (i === state.onboardingStep) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
        
        // Update Step dots
        const dot = document.querySelector(`.step-dot[data-step="${i}"]`);
        if (i < state.onboardingStep) {
            dot.className = 'step-dot completed';
            dot.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i>';
        } else if (i === state.onboardingStep) {
            dot.className = 'step-dot active';
            dot.textContent = i;
        } else {
            dot.className = 'step-dot';
            dot.textContent = i;
        }
    }
    
    // Update progress bar width
    const progressBar = document.getElementById('onboarding-progress');
    progressBar.style.width = `${((state.onboardingStep - 1) / 2) * 96}%`; // visual alignment balance

    // Update buttons
    const btnBack = document.getElementById('btn-back');
    const btnNext = document.getElementById('btn-next');

    if (state.onboardingStep === 1) {
        btnBack.classList.add('hidden');
    } else {
        btnBack.classList.remove('hidden');
    }

    if (state.onboardingStep === 3) {
        btnNext.innerHTML = 'Explore Hub <i data-lucide="sparkles" style="width: 18px; height: 18px;"></i>';
    } else {
        btnNext.innerHTML = 'Next <i data-lucide="arrow-right" style="width: 18px; height: 18px;"></i>';
    }
    
    lucide.createIcons();
}

// --- DASHBOARD SYSTEM ORCHESTRATION ---
function loadDashboard() {
    showView('dashboard-view');
    
    // Profile Sidebar updates
    document.getElementById('user-display-name').textContent = state.currentUser.name;
    document.getElementById('user-display-grade').textContent = state.currentUser.profile.grade;
    document.getElementById('user-avatar').src = AVATAR_MAP[state.currentUser.profile.avatar] || AVATAR_MAP['1'];
    
    // Summary Tab specific updates
    document.getElementById('welcome-message').textContent = `Welcome back, ${state.currentUser.name.split(' ')[0]}!`;
    
    // Auto sync dashboard tabs
    switchDashboardTab(state.activeTab);
}

window.switchDashboardTab = function(tabName) {
    state.activeTab = tabName;
    
    // Sidebar active item styling
    const menuItems = document.querySelectorAll('.nav-item');
    menuItems.forEach(item => {
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Toggle tab sections
    const tabs = ['summary', 'timetable', 'study-plans', 'ol-template', 'settings'];
    tabs.forEach(t => {
        const sec = document.getElementById(`tab-content-${t}`);
        if (t === tabName) {
            sec.classList.remove('hidden');
        } else {
            sec.classList.add('hidden');
        }
    });

    // Specific loaders
    if (tabName === 'summary') {
        renderSummaryTab();
    } else if (tabName === 'timetable') {
        renderTimetableTab();
    } else if (tabName === 'study-plans') {
        renderStudyPlansTab();
    } else if (tabName === 'ol-template') {
        lucide.createIcons();
    } else if (tabName === 'settings') {
        renderSettingsTab();
    }

    lucide.createIcons();
};

// --- TAB 1: SUMMARY / OVERVIEW CONTROLLER ---
function renderSummaryTab() {
    // Study streak math (mock calculation, incrementing daily)
    const today = new Date().toDateString();
    let streak = 0;
    if (state.studyPlans.length > 0) {
        // If they checked tasks, calculate study streak
        const completionLogs = state.studyPlans.some(p => p.tasks.some(t => t.completed));
        streak = completionLogs ? 5 : 0; // standard mock starter streak
    }
    document.getElementById('stat-streak').textContent = `${streak} Days`;

    // Weekly class hours summary math
    let classHours = 0;
    state.timetableSlots.forEach(c => {
        const startH = parseInt(c.start.split(':')[0]);
        const endH = parseInt(c.end.split(':')[0]);
        classHours += (endH - startH);
    });
    document.getElementById('stat-class-hours').textContent = `${classHours} hrs`;

    // Active Study Plans count
    document.getElementById('stat-plans-count').textContent = `${state.studyPlans.length} Plans`;

    // Render Today's Date
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('today-date-str').textContent = new Date().toLocaleDateString('en-US', dateOptions);

    // Agenda rendering
    const agendaList = document.getElementById('agenda-list');
    agendaList.innerHTML = '';

    const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    // Class slots matching current day
    const todaysClasses = state.timetableSlots.filter(c => c.day === currentDayName);

    if (todaysClasses.length === 0 && state.studyPlans.length === 0) {
        agendaList.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar-days" style="width: 32px; height: 32px;"></i>
                <p>No classes or study tasks scheduled for today. Relax!</p>
            </div>`;
    } else {
        // Render classes
        todaysClasses.forEach(cls => {
            const div = document.createElement('div');
            div.className = 'agenda-item';
            div.innerHTML = `
                <div class="agenda-left">
                    <span class="agenda-badge" style="background-color: var(--primary);"></span>
                    <div class="agenda-info">
                        <h4>${cls.name}</h4>
                        <p><i data-lucide="map-pin" style="width: 10px; height: 10px; display:inline; margin-right: 3px;"></i> ${cls.location || 'Virtual Platform'}</p>
                    </div>
                </div>
                <div class="agenda-right">
                    ${formatTime(cls.start)} - ${formatTime(cls.end)}
                </div>
            `;
            agendaList.appendChild(div);
        });

        // Add today's study plan tasks (if any study plans exist)
        state.studyPlans.forEach(plan => {
            // Find first incomplete task for today
            const task = plan.tasks.find(t => !t.completed);
            if (task) {
                const div = document.createElement('div');
                div.className = 'agenda-item';
                div.innerHTML = `
                    <div class="agenda-left">
                        <span class="agenda-badge" style="background-color: #10b981;"></span>
                        <div class="agenda-info">
                            <h4>Study: ${plan.subject}</h4>
                            <p>${task.text}</p>
                        </div>
                    </div>
                    <div class="agenda-right" style="color: #10b981;">
                        ${task.duration} min
                    </div>
                `;
                agendaList.appendChild(div);
            }
        });
    }
}

function formatTime(militaryTime) {
    const hours = parseInt(militaryTime.split(':')[0]);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:00 ${ampm}`;
}

// --- POMODORO TIMER SYSTEM ---
window.toggleTimer = function() {
    const btn = document.getElementById('timer-toggle-btn');
    if (state.timerIsRunning) {
        clearInterval(state.timerInterval);
        state.timerIsRunning = false;
        btn.querySelector('span').textContent = 'Start';
        btn.querySelector('svg').outerHTML = '<i data-lucide="play" style="width: 18px; height: 18px;"></i>';
    } else {
        state.timerIsRunning = true;
        btn.querySelector('span').textContent = 'Pause';
        btn.querySelector('svg').outerHTML = '<i data-lucide="pause" style="width: 18px; height: 18px;"></i>';
        
        state.timerInterval = setInterval(() => {
            state.timerSeconds--;
            updateTimerDisplay();
            
            if (state.timerSeconds <= 0) {
                clearInterval(state.timerInterval);
                state.timerIsRunning = false;
                playTimerChime();
                handleTimerFinished();
            }
        }, 1000);
    }
    lucide.createIcons();
};

window.resetTimer = function() {
    clearInterval(state.timerInterval);
    state.timerIsRunning = false;
    
    // Reset to current mode duration
    if (state.timerMode === 'work') state.timerSeconds = 1500;
    else if (state.timerMode === 'short') state.timerSeconds = 300;
    else if (state.timerMode === 'long') state.timerSeconds = 900;
    
    updateTimerDisplay();
    
    const btn = document.getElementById('timer-toggle-btn');
    btn.querySelector('span').textContent = 'Start';
    btn.querySelector('svg').outerHTML = '<i data-lucide="play" style="width: 18px; height: 18px;"></i>';
    lucide.createIcons();
};

window.setTimerMode = function(mode) {
    state.timerMode = mode;
    
    // UI selection active toggles
    const modeBtns = document.querySelectorAll('.timer-mode-btn');
    modeBtns.forEach(btn => {
        if (btn.dataset.duration == (mode === 'work' ? 25 : mode === 'short' ? 5 : 15)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('remove'); // safety clean
        }
    });

    // Make sure correct btn is set to active class
    modeBtns[0].classList.toggle('active', mode === 'work');
    modeBtns[1].classList.toggle('active', mode === 'short');
    modeBtns[2].classList.toggle('active', mode === 'long');

    resetTimer();
};

function updateTimerDisplay() {
    const mins = Math.floor(state.timerSeconds / 60);
    const secs = state.timerSeconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('timer-time').textContent = timeStr;
}

function handleTimerFinished() {
    alert(state.timerMode === 'work' ? 'Great focus block! Time for a short break.' : 'Break finished! Time to get back to studying.');
    
    // Switch modes automatically
    if (state.timerMode === 'work') {
        setTimerMode('short');
    } else {
        setTimerMode('work');
    }
}

function playTimerChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Custom synthesizer chime sound using oscillator nodes
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5 note
        
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
        console.warn('Audio Context failed to play chime due to interaction rules: ', e);
    }
}

// --- TAB 2: TIMETABLE VIEW CONTROLLER ---
const TIMETABLE_HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function renderTimetableTab() {
    const grid = document.getElementById('timetable-calendar');
    
    // Preserve header elements, remove dynamic cells
    const headerCellsCount = 8; // Time + 7 days
    while (grid.children.length > headerCellsCount) {
        grid.removeChild(grid.lastChild);
    }

    // Build rows hour by hour
    TIMETABLE_HOURS.forEach(hr => {
        // Time slot label cell
        const timeCell = document.createElement('div');
        timeCell.className = 'calendar-cell calendar-time-label';
        timeCell.textContent = formatTime(hr);
        grid.appendChild(timeCell);

        // Day cells
        TIMETABLE_DAYS.forEach(day => {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-cell';
            dayCell.dataset.day = day;
            dayCell.dataset.hour = hr;
            
            // Double click or simple click to add class
            dayCell.addEventListener('click', (e) => {
                if (e.target === dayCell) {
                    openClassModal(day, hr);
                }
            });

            // Find matching class
            const matchedClass = state.timetableSlots.find(c => c.day === day && c.start === hr);
            if (matchedClass) {
                const classCard = document.createElement('div');
                classCard.className = `class-card color-${matchedClass.color || 'purple'}`;
                classCard.innerHTML = `
                    <div class="class-title">${matchedClass.name}</div>
                    <div class="class-details">${matchedClass.location || ''}</div>
                `;
                classCard.addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent grid slot trigger
                    openClassModal(day, hr, matchedClass.id);
                });
                dayCell.appendChild(classCard);
            }

            grid.appendChild(dayCell);
        });
    });

    // Render mobile list view
    renderMobileTimetableList();
}

function renderMobileTimetableList() {
    const listContainer = document.getElementById('timetable-list-view');
    if (!listContainer) return;

    if (state.timetableSlots.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar" style="width: 36px; height: 36px;"></i>
                <p>No classes scheduled yet. Click "Add Class" or load the OL template to start.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    listContainer.innerHTML = '';
    TIMETABLE_DAYS.forEach(day => {
        const dayClasses = state.timetableSlots.filter(c => c.day === day);
        if (dayClasses.length === 0) return; // Skip days with no classes

        const daySection = document.createElement('div');
        daySection.className = 'timetable-list-day-section';
        daySection.innerHTML = `<h3 class="list-day-title">${day}</h3>`;

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'list-cards-container';

        // Sort classes by time
        dayClasses.sort((a, b) => a.start.localeCompare(b.start));

        dayClasses.forEach(cls => {
            const card = document.createElement('div');
            card.className = `list-class-card color-${cls.color || 'purple'}`;
            
            // Format time range
            const timeRange = `${formatTime(cls.start)} - ${formatTime(cls.end)}`;

            card.innerHTML = `
                <div class="list-class-left">
                    <span class="list-class-time">${timeRange}</span>
                    <h4 class="list-class-name">${cls.name}</h4>
                    ${cls.location ? `<span class="list-class-loc"><i data-lucide="map-pin" style="width: 10px; height: 10px; display:inline-block; margin-right: 3px; vertical-align:middle;"></i> ${cls.location}</span>` : ''}
                </div>
                <button class="btn btn-secondary btn-icon" onclick="openClassModal('${day}', '${cls.start}', '${cls.id}')" style="padding: 6px;">
                    <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                </button>
            `;
            cardsContainer.appendChild(card);
        });

        daySection.appendChild(cardsContainer);
        listContainer.appendChild(daySection);
    });

    lucide.createIcons();
}

function initColorSelectors() {
    const colorSelectors = [
        { selector: '#class-color-selector .color-dot-opt', stateProp: 'classColor' },
        { selector: '.color-option-container .color-dot-opt', stateProp: 'planColor' }
    ];

    colorSelectors.forEach(cfg => {
        const dots = document.querySelectorAll(cfg.selector);
        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                dots.forEach(d => d.classList.remove('selected'));
                dot.classList.add('selected');
            });
        });
    });
}

window.adjustClassEndTime = function() {
    const startSelect = document.getElementById('class-start');
    const endSelect = document.getElementById('class-end');
    const startHour = parseInt(startSelect.value.split(':')[0]);
    
    // Force end select options to be greater than start hour
    Array.from(endSelect.options).forEach(opt => {
        const valHour = parseInt(opt.value.split(':')[0]);
        if (valHour <= startHour) {
            opt.disabled = true;
        } else {
            opt.disabled = false;
        }
    });

    // Auto set end hour to start + 1
    const defaultEndHourStr = `${(startHour + 1).toString().padStart(2, '0')}:00`;
    if (parseInt(endSelect.value.split(':')[0]) <= startHour) {
        endSelect.value = defaultEndHourStr;
    }
};

window.openClassModal = function(day = 'Monday', startHour = '08:00', editId = null) {
    const modal = document.getElementById('class-modal');
    const form = document.getElementById('class-form');
    const titleEl = document.getElementById('class-modal-title');
    const delBtn = document.getElementById('btn-delete-class');
    
    form.reset();
    adjustClassEndTime();

    // Default setups
    document.getElementById('class-day').value = day;
    document.getElementById('class-start').value = startHour;
    adjustClassEndTime(); // correct end values based on start
    
    // Clear selected color active state
    const dots = document.querySelectorAll('#class-color-selector .color-dot-opt');
    dots.forEach(d => d.classList.remove('selected'));
    dots[0].classList.add('selected');

    if (editId) {
        titleEl.textContent = 'Edit Class Details';
        delBtn.classList.remove('hidden');
        document.getElementById('class-edit-id').value = editId;

        const cls = state.timetableSlots.find(c => c.id === editId);
        if (cls) {
            document.getElementById('class-name').value = cls.name;
            document.getElementById('class-day').value = cls.day;
            document.getElementById('class-start').value = cls.start;
            adjustClassEndTime();
            document.getElementById('class-end').value = cls.end;
            document.getElementById('class-location').value = cls.location || '';
            
            // Set correct color dot
            dots.forEach(d => {
                if (d.dataset.color === cls.color) {
                    d.classList.add('selected');
                } else {
                    d.classList.remove('selected');
                }
            });
        }
    } else {
        titleEl.textContent = 'Add Class Slot';
        delBtn.classList.add('hidden');
        document.getElementById('class-edit-id').value = '';
    }

    modal.classList.remove('hidden');
    lucide.createIcons();
};

window.closeClassModal = function() {
    document.getElementById('class-modal').classList.add('hidden');
};

window.saveClassSlot = function(event) {
    event.preventDefault();

    const name = document.getElementById('class-name').value.trim();
    const day = document.getElementById('class-day').value;
    const start = document.getElementById('class-start').value;
    const end = document.getElementById('class-end').value;
    const location = document.getElementById('class-location').value.trim();
    const editId = document.getElementById('class-edit-id').value;
    
    const activeColorDot = document.querySelector('#class-color-selector .color-dot-opt.selected');
    const color = activeColorDot ? activeColorDot.dataset.color : 'purple';

    // Conflict validation (ignore the currently editing class slot)
    const conflict = state.timetableSlots.some(c => 
        c.id !== editId && 
        c.day === day && 
        c.start === start
    );

    if (conflict) {
        alert('This time slot overlaps with another scheduled class.');
        return;
    }

    if (editId) {
        // Edit existing slot
        state.timetableSlots = state.timetableSlots.map(c => 
            c.id === editId ? { id: editId, name, day, start, end, location, color } : c
        );
    } else {
        // Create new slot
        const newSlot = {
            id: Date.now().toString(),
            name,
            day,
            start,
            end,
            location,
            color
        };
        state.timetableSlots.push(newSlot);
    }

    saveUserData();
    closeClassModal();
    renderTimetableTab();
    
    // sync overview if needed
    if (state.activeTab === 'summary') renderSummaryTab();
};

window.deleteClassSlot = function() {
    const editId = document.getElementById('class-edit-id').value;
    if (!editId) return;

    if (confirm('Are you sure you want to remove this class from your timetable?')) {
        state.timetableSlots = state.timetableSlots.filter(c => c.id !== editId);
        saveUserData();
        closeClassModal();
        renderTimetableTab();
    }
};

window.loadOLTemplate = function() {
    if (state.timetableSlots.length > 0 && !confirm('Loading the OL Timetable Template will replace your current timetable slots. Do you want to proceed?')) {
        return;
    }

    const olTemplate = [
        // Monday
        { id: 'ol-mon-1', name: 'Mathematics', day: 'Monday', start: '16:00', end: '17:00', location: 'OL Class', color: 'purple' },
        { id: 'ol-mon-2', name: 'Science', day: 'Monday', start: '17:00', end: '18:00', location: 'OL Class', color: 'cyan' },
        { id: 'ol-mon-3', name: 'English', day: 'Monday', start: '19:00', end: '20:00', location: 'OL Class', color: 'emerald' },
        { id: 'ol-mon-4', name: 'Homework & Revision', day: 'Monday', start: '20:00', end: '21:00', location: 'Home Study', color: 'amber' },

        // Tuesday
        { id: 'ol-tue-1', name: 'Sinhala', day: 'Tuesday', start: '16:00', end: '17:00', location: 'OL Class', color: 'rose' },
        { id: 'ol-tue-2', name: 'History', day: 'Tuesday', start: '17:00', end: '18:00', location: 'OL Class', color: 'purple' },
        { id: 'ol-tue-3', name: 'Buddhism/Religion', day: 'Tuesday', start: '19:00', end: '20:00', location: 'OL Class', color: 'amber' },
        { id: 'ol-tue-4', name: 'Past Paper Practice', day: 'Tuesday', start: '20:00', end: '21:00', location: 'Home Study', color: 'cyan' },

        // Wednesday
        { id: 'ol-wed-1', name: 'Mathematics', day: 'Wednesday', start: '16:00', end: '17:00', location: 'OL Class', color: 'purple' },
        { id: 'ol-wed-2', name: 'English', day: 'Wednesday', start: '17:00', end: '18:00', location: 'OL Class', color: 'emerald' },
        { id: 'ol-wed-3', name: 'ICT', day: 'Wednesday', start: '19:00', end: '20:00', location: 'OL Class', color: 'cyan' },
        { id: 'ol-wed-4', name: 'Homework & Revision', day: 'Wednesday', start: '20:00', end: '21:00', location: 'Home Study', color: 'amber' },

        // Thursday
        { id: 'ol-thu-1', name: 'Science', day: 'Thursday', start: '16:00', end: '17:00', location: 'OL Class', color: 'cyan' },
        { id: 'ol-thu-2', name: 'Geography', day: 'Thursday', start: '17:00', end: '18:00', location: 'OL Class', color: 'rose' },
        { id: 'ol-thu-3', name: 'Tamil (Second Language)', day: 'Thursday', start: '19:00', end: '20:00', location: 'OL Class', color: 'purple' },
        { id: 'ol-thu-4', name: 'Past Paper Practice', day: 'Thursday', start: '20:00', end: '21:00', location: 'Home Study', color: 'cyan' },

        // Friday
        { id: 'ol-fri-1', name: 'Commerce', day: 'Friday', start: '16:00', end: '17:00', location: 'OL Class', color: 'amber' },
        { id: 'ol-fri-2', name: 'Weakest Subject Revision', day: 'Friday', start: '17:00', end: '18:00', location: 'OL Class', color: 'rose' },
        { id: 'ol-fri-3', name: 'Mixed Revision', day: 'Friday', start: '19:00', end: '20:00', location: 'OL Class', color: 'purple' },
        { id: 'ol-fri-4', name: 'Plan for Next Week', day: 'Friday', start: '20:00', end: '21:00', location: 'Home Study', color: 'emerald' }
    ];

    state.timetableSlots = olTemplate;
    saveUserData();
    renderTimetableTab();
    
    // Automatically add subjects to user catalog
    const olSubjects = ['Mathematics', 'Science', 'English', 'Sinhala', 'History', 'Buddhism/Religion', 'ICT', 'Geography', 'Tamil (Second Language)', 'Commerce'];
    olSubjects.forEach(sub => {
        if (!state.currentUser.profile.subjects.includes(sub)) {
            state.currentUser.profile.subjects.push(sub);
        }
    });
    saveUserData();

    if (state.activeTab === 'summary') renderSummaryTab();
    alert('Ordinary Level (OL) Timetable Template loaded successfully! Your subject catalog has also been populated.');
};

// --- TAB 3: STUDY PLAN GENERATOR CONTROLLER ---
function renderStudyPlansTab() {
    // Populate subject select field dynamically based on profile subjects
    const select = document.getElementById('plan-subject');
    select.innerHTML = '';
    state.currentUser.profile.subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        select.appendChild(opt);
    });

    // Populate active pace selectors toggle
    const paceSelectors = document.querySelectorAll('#study-plan-form .card-selector');
    paceSelectors.forEach(sel => {
        sel.onclick = () => {
            paceSelectors.forEach(s => s.classList.remove('selected'));
            sel.classList.add('selected');
        };
    });

    // Render results panel
    renderGeneratedPlans();
}

window.generateStudyPlan = function(event) {
    event.preventDefault();

    const subject = document.getElementById('plan-subject').value;
    const examTitle = document.getElementById('plan-exam-title').value.trim();
    const examDateStr = document.getElementById('plan-date').value;
    const confidence = parseInt(document.getElementById('plan-confidence').value);
    
    const activePaceSelector = document.querySelector('#study-plan-form .card-selector.selected');
    const pace = activePaceSelector ? activePaceSelector.dataset.pace : 'steady';

    const activeColorDot = document.querySelector('.color-option-container .color-dot-opt.selected');
    const color = activeColorDot ? activeColorDot.dataset.color : 'purple';

    // Calculate days remaining
    const examDate = new Date(examDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = examDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        alert('The exam date must be in the future.');
        return;
    }

    // Generate dynamic checklist tasks based on confidence & pace
    const generatedTasks = buildStudyTasks(diffDays, confidence, pace);

    const newPlan = {
        id: Date.now().toString(),
        subject,
        examTitle,
        examDate: examDateStr,
        confidence,
        pace,
        color,
        tasks: generatedTasks
    };

    state.studyPlans.push(newPlan);
    saveUserData();
    
    // Clear form inputs
    document.getElementById('plan-exam-title').value = '';
    
    renderGeneratedPlans();
    selectActiveStudyPlan(newPlan.id);
};

function buildStudyTasks(daysRemaining, confidence, pace) {
    let tasks = [];
    const actualDays = Math.min(daysRemaining, 14); // cap timeline layout to 14 days maximum to avoid massive lists

    const taskTemplates = {
        lowConfidence: [
            "Read primary textbook chapters and highlight definitions.",
            "Watch video tutorials explaining foundational logic.",
            "Complete basic homework questions to build trust.",
            "Draft clean cheat sheets listing equations or rules.",
            "Practice core derivations step-by-step.",
            "Solve flashcards containing terminology.",
            "Attempt mock midterms under open-book terms.",
            "Fix common mistakes made during practice sets.",
            "Review summaries and sleep early."
        ],
        highConfidence: [
            "Outline key syllabus modules briefly.",
            "Complete high-difficulty sample problems.",
            "Sit for standard examination papers timed.",
            "Engage in revision games or quiz drills.",
            "Solve complex past exam questions.",
            "Analyze and write down test-taking strategies.",
            "Teach complex concepts to a study partner.",
            "Light review of visual mind-maps."
        ]
    };

    const coreTemplates = confidence <= 3 ? taskTemplates.lowConfidence : taskTemplates.highConfidence;

    for (let day = 1; day <= actualDays; day++) {
        // Pacing logic duration calculation
        let baseMinutes = 45;
        if (pace === 'cram') baseMinutes = 90;
        if (confidence === 1) baseMinutes += 30; // low confidence demands extra work
        if (confidence === 5) baseMinutes -= 15; // master index requires less time

        // Pick specific day task context
        let taskIndex = (day - 1) % coreTemplates.length;
        let taskText = coreTemplates[taskIndex];

        // Custom day suffixes
        if (day === actualDays) {
            taskText = "Perform final overview of formulas, summaries, and sleep at least 8 hours.";
            baseMinutes = 30;
        } else if (day === actualDays - 1) {
            taskText = "Complete comprehensive timed practice mock exam to lock in readiness.";
        }

        tasks.push({
            id: `${day}-${Date.now()}`,
            text: `Day ${day}: ${taskText}`,
            duration: baseMinutes,
            completed: false
        });
    }

    return tasks;
}

function renderGeneratedPlans() {
    const container = document.getElementById('plan-header-container');
    container.innerHTML = '';

    if (state.studyPlans.length === 0) {
        return;
    }

    // Render list selector pills
    const titleEl = document.createElement('h3');
    titleEl.textContent = 'Active Study Synergies';
    titleEl.style.fontSize = '1rem';
    titleEl.style.marginBottom = '12px';
    container.appendChild(titleEl);

    const pillsDiv = document.createElement('div');
    pillsDiv.className = 'tags-container';
    pillsDiv.style.marginBottom = '20px';

    state.studyPlans.forEach(plan => {
        const completedCount = plan.tasks.filter(t => t.completed).length;
        const percent = Math.round((completedCount / plan.tasks.length) * 100);

        const pill = document.createElement('div');
        pill.className = `tag-pill`;
        pill.style.borderColor = `var(--${plan.color})`;
        pill.innerHTML = `<strong>${plan.subject}</strong> - ${plan.examTitle} (${percent}%)`;
        pill.onclick = () => selectActiveStudyPlan(plan.id);
        pillsDiv.appendChild(pill);
    });

    container.appendChild(pillsDiv);
}

function selectActiveStudyPlan(planId) {
    const container = document.getElementById('study-days-container');
    container.innerHTML = '';

    const plan = state.studyPlans.find(p => p.id === planId);
    if (!plan) return;

    // Render header card details
    const completedCount = plan.tasks.filter(t => t.completed).length;
    const percent = Math.round((completedCount / plan.tasks.length) * 100);

    const header = document.createElement('div');
    header.className = `glass-panel plan-header-card`;
    header.style.borderLeftColor = `var(--${plan.color})`;
    header.innerHTML = `
        <div class="plan-header-left">
            <h3>${plan.subject}: ${plan.examTitle}</h3>
            <p>Exam Date: ${new Date(plan.examDate).toLocaleDateString()} | Strategy Pace: ${plan.pace.toUpperCase()}</p>
        </div>
        <button class="btn btn-danger btn-icon" onclick="deleteStudyPlan('${plan.id}')" title="Delete Plan">
            <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
        </button>
    `;
    container.appendChild(header);

    // List of tasks
    const tasksWrapper = document.createElement('div');
    tasksWrapper.className = 'study-tasks-list';
    tasksWrapper.style.marginTop = '15px';

    plan.tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
        taskItem.innerHTML = `
            <div class="task-checkbox-container">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTaskCompletion('${plan.id}', '${task.id}')">
                    ${task.completed ? '<i data-lucide="check"></i>' : ''}
                </div>
            </div>
            <div class="task-text">${task.text}</div>
            <span class="task-duration">${task.duration} min</span>
        `;
        tasksWrapper.appendChild(taskItem);
    });

    container.appendChild(tasksWrapper);
    lucide.createIcons();
}

window.toggleTaskCompletion = function(planId, taskId) {
    state.studyPlans = state.studyPlans.map(p => {
        if (p.id === planId) {
            p.tasks = p.tasks.map(t => {
                if (t.id === taskId) {
                    return { ...t, completed: !t.completed };
                }
                return t;
            });
        }
        return p;
    });

    saveUserData();
    
    // Re-render checklist and pills
    renderGeneratedPlans();
    selectActiveStudyPlan(planId);
    
    // Sync summary statistics
    if (state.activeTab === 'summary') renderSummaryTab();
};

window.deleteStudyPlan = function(planId) {
    if (confirm('Are you sure you want to permanently delete this study strategy?')) {
        state.studyPlans = state.studyPlans.filter(p => p.id !== planId);
        saveUserData();
        
        renderStudyPlansTab();
        
        // Sync summary statistics
        if (state.activeTab === 'summary') renderSummaryTab();
    }
};

// --- TAB 4: SETTINGS VIEW CONTROLLER ---
function renderSettingsTab() {
    const p = state.currentUser.profile;
    
    document.getElementById('settings-avatar-img').src = AVATAR_MAP[p.avatar] || AVATAR_MAP['1'];
    document.getElementById('settings-name').value = state.currentUser.name;
    document.getElementById('settings-grade').value = p.grade;
    document.getElementById('settings-hours').value = p.targetHours;

    renderSettingsSubjects();
}

function renderSettingsSubjects() {
    const container = document.getElementById('settings-subjects-container');
    container.innerHTML = '';
    
    state.currentUser.profile.subjects.forEach(sub => {
        const pill = document.createElement('div');
        pill.className = 'tag-pill selected';
        pill.innerHTML = `${sub} <i data-lucide="x" style="width:12px; height:12px; margin-left: 5px; display:inline-block; vertical-align:middle;"></i>`;
        pill.onclick = () => {
            if (confirm(`Remove ${sub} from your curriculum?`)) {
                state.currentUser.profile.subjects = state.currentUser.profile.subjects.filter(s => s !== sub);
                saveUserData();
                renderSettingsSubjects();
            }
        };
        container.appendChild(pill);
    });
    lucide.createIcons();
}

window.addSettingsCustomSubject = function() {
    const input = document.getElementById('settings-new-subject');
    const val = input.value.trim();
    if (!val) return;

    if (state.currentUser.profile.subjects.includes(val)) {
        alert('Subject already exists.');
        return;
    }

    state.currentUser.profile.subjects.push(val);
    saveUserData();
    input.value = '';
    renderSettingsSubjects();
};

window.saveProfileSettings = function(event) {
    event.preventDefault();

    const name = document.getElementById('settings-name').value.trim();
    const grade = document.getElementById('settings-grade').value;
    const targetHours = parseInt(document.getElementById('settings-hours').value) || 15;

    state.currentUser.name = name;
    state.currentUser.profile.grade = grade;
    state.currentUser.profile.targetHours = targetHours;

    saveUserData();
    alert('Profile configurations updated successfully!');
    
    // Refresh dashboard layout details
    loadDashboard();
};

// Avatar Change Modal Methods
window.openAvatarModal = function() {
    const modal = document.getElementById('avatar-modal');
    
    const dots = document.querySelectorAll('#settings-avatar-options .avatar-opt');
    dots.forEach(d => {
        if (d.dataset.avatar === state.currentUser.profile.avatar) {
            d.classList.add('selected');
        } else {
            d.classList.remove('selected');
        }
        
        d.onclick = () => {
            dots.forEach(o => o.classList.remove('selected'));
            d.classList.add('selected');
        };
    });

    modal.classList.remove('hidden');
};

window.closeAvatarModal = function() {
    document.getElementById('avatar-modal').classList.add('hidden');
};

window.saveSettingsAvatar = function() {
    const selected = document.querySelector('#settings-avatar-options .avatar-opt.selected');
    if (selected) {
        state.currentUser.profile.avatar = selected.dataset.avatar;
        saveUserData();
        closeAvatarModal();
        renderSettingsTab();
        
        // Refresh sidebar avatar
        document.getElementById('user-avatar').src = AVATAR_MAP[selected.dataset.avatar];
    }
};
