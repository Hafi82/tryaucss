// State Management
const initialState = {
    setup: {
        trophyName: '',
        teams: [],
        totalPlayers: 0,
        teamFund: 0
    },
    players: {
        all: [],
        sold: [],
        unsold: []
    },
    history: []
};

let appState = JSON.parse(localStorage.getItem('auctionState')) || JSON.parse(JSON.stringify(initialState));

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.section');
const setupForm = document.getElementById('setup-form');
const teamsContainer = document.getElementById('teams-container');
const addTeamBtn = document.getElementById('add-team-btn');
const resetSetupBtn = document.getElementById('reset-setup-btn');
const playerUpload = document.getElementById('player-upload');
const uploadBtn = document.getElementById('upload-btn');
const allPlayersList = document.getElementById('all-players-list');
const soldPlayersList = document.getElementById('sold-players-list');
const unsoldPlayersList = document.getElementById('unsold-players-list');
const wheelCanvas = document.getElementById('wheel-canvas');
const spinBtn = document.getElementById('spin-btn');
const playerRevealModal = document.getElementById('player-reveal-modal');
const revealedPlayerName = document.getElementById('revealed-player-name');
const revealedPlayerImg = document.getElementById('revealed-player-img');
const buyerTeamSelect = document.getElementById('buyer-team');
const bidAmountInput = document.getElementById('bid-amount');
const confirmSellBtn = document.getElementById('confirm-sell-btn');
const markUnsoldBtn = document.getElementById('mark-unsold-btn');
const teamsDashboard = document.getElementById('teams-dashboard');
const reportsBody = document.getElementById('reports-body');
const exportCsvBtn = document.getElementById('export-csv-btn');

// --- Navigation ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const target = item.dataset.section;

        // Update Nav UI
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Update Section UI
        sections.forEach(sec => sec.classList.remove('active'));
        document.getElementById(target).classList.add('active');

        // Refresh Data if needed
        if (target === 'spinner') initWheel();
        if (target === 'expenses') renderDashboard();
        if (target === 'reports') renderReports();
    });
});

// --- Tab Switching (Players Panel) ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.remove('hidden');
    });
});

// --- Persistence ---
function saveState() {
    localStorage.setItem('auctionState', JSON.stringify(appState));
}

// --- Section 1: Setup ---
addTeamBtn.addEventListener('click', () => {
    const div = document.createElement('div');
    div.className = 'team-input-group';
    div.innerHTML = `<input type="text" class="team-name" placeholder="Team Name" required>`;
    teamsContainer.appendChild(div);
});

setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const teamInputs = document.querySelectorAll('.team-name');
    const teams = Array.from(teamInputs).map(input => ({
        name: input.value,
        spent: 0,
        players: []
    })).filter(t => t.name.trim() !== '');

    appState.setup = {
        trophyName: document.getElementById('trophy-name').value,
        teams: teams,
        totalPlayers: parseInt(document.getElementById('total-players').value),
        teamFund: parseFloat(document.getElementById('team-fund').value)
    };

    saveState();
    alert('Auction Setup Completed!');
    renderDashboard(); // Pre-render dashboard
});

resetSetupBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all auction data? This cannot be undone.')) {
        appState = JSON.parse(JSON.stringify(initialState));
        saveState();
        location.reload();
    }
});

// --- Section 2: Players ---
uploadBtn.addEventListener('click', () => playerUpload.click());

playerUpload.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const player = {
                id: Date.now() + Math.random(),
                name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
                image: event.target.result,
                status: 'available' // available, sold, unsold
            };
            appState.players.all.push(player);
            saveState();
            renderPlayers();
        };
        reader.readAsDataURL(file);
    });
});

function renderPlayers() {
    // Render All
    allPlayersList.innerHTML = '';
    appState.players.all.filter(p => p.status === 'available').forEach(p => {
        allPlayersList.appendChild(createPlayerCard(p));
    });

    // Render Sold
    soldPlayersList.innerHTML = '';
    appState.players.sold.forEach(p => {
        soldPlayersList.appendChild(createPlayerCard(p, false));
    });

    // Render Unsold
    unsoldPlayersList.innerHTML = '';
    appState.players.unsold.forEach(p => {
        const card = createPlayerCard(p, false);
        const moveBtn = document.createElement('button');
        moveBtn.innerText = 'Move to All';
        moveBtn.className = 'btn-secondary';
        moveBtn.style.fontSize = '12px';
        moveBtn.style.marginTop = '5px';
        moveBtn.onclick = () => moveUnsoldToAll(p.id);
        card.appendChild(moveBtn);
        unsoldPlayersList.appendChild(card);
    });
}

function createPlayerCard(player, showRemove = true) {
    const div = document.createElement('div');
    div.className = 'player-card';
    div.innerHTML = `
        <img src="${player.image}" alt="${player.name}">
        <p>${player.name}</p>
    `;
    if (showRemove) {
        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-btn';
        removeBtn.innerText = 'X';
        removeBtn.onclick = () => removePlayer(player.id);
        div.appendChild(removeBtn);
    }
    return div;
}

function removePlayer(id) {
    if (confirm('Remove this player?')) {
        appState.players.all = appState.players.all.filter(p => p.id !== id);
        saveState();
        renderPlayers();
    }
}

function moveUnsoldToAll(id) {
    const playerIndex = appState.players.unsold.findIndex(p => p.id === id);
    if (playerIndex > -1) {
        const player = appState.players.unsold.splice(playerIndex, 1)[0];
        player.status = 'available';
        appState.players.all.push(player);
        saveState();
        renderPlayers();
    }
}

// --- Section 3: Spinner ---
let wheelContext = wheelCanvas.getContext('2d');
let currentRotation = 0;
let isSpinning = false;
let selectedPlayer = null;

function initWheel() {
    const availablePlayers = appState.players.all.filter(p => p.status === 'available');
    if (availablePlayers.length === 0) {
        // Clear canvas if no players
        wheelContext.clearRect(0, 0, 500, 500);
        return;
    }
    drawWheel(availablePlayers);

    // Populate buyer select
    buyerTeamSelect.innerHTML = '<option value="">Select Team</option>';
    appState.setup.teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.name;
        option.innerText = team.name;
        buyerTeamSelect.appendChild(option);
    });
}

function drawWheel(players, rotation = 0) {
    const ctx = wheelContext;
    const centerX = 250;
    const centerY = 250;
    const radius = 240;
    const sliceAngle = (2 * Math.PI) / players.length;

    ctx.clearRect(0, 0, 500, 500);

    players.forEach((player, i) => {
        const startAngle = rotation + (i * sliceAngle);
        const endAngle = rotation + ((i + 1) * sliceAngle);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.fillStyle = i % 2 === 0 ? '#e94560' : '#16213e'; // Alternating colors
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "white";
        ctx.font = "14px Inter";
        ctx.fillText(player.name, radius - 20, 5);
        ctx.restore();
    });
}

spinBtn.addEventListener('click', () => {
    const availablePlayers = appState.players.all.filter(p => p.status === 'available');
    if (isSpinning || availablePlayers.length === 0) return;

    isSpinning = true;
    playerRevealModal.classList.add('hidden');

    // Random spin duration and rotation
    const spinDuration = 3000; // 3 seconds
    const totalRotation = Math.random() * 360 + 1440; // At least 4 full spins
    const startTime = performance.now();
    const startRotation = currentRotation;

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);

        // Ease out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        currentRotation = startRotation + (totalRotation * (Math.PI / 180) * ease);

        drawWheel(availablePlayers, currentRotation);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            determineWinner(availablePlayers);
        }
    }
    requestAnimationFrame(animate);
});

function determineWinner(players) {
    // Normalize rotation to 0-2PI
    const normalizedRotation = currentRotation % (2 * Math.PI);
    const sliceAngle = (2 * Math.PI) / players.length;

    // The arrow is at the top (3PI/2 or -PI/2 in canvas coords, but we drew from 0)
    // Actually, 0 is 3 o'clock. Top is 270 deg or 3PI/2.
    // We need to find which slice is at 3PI/2.
    // Let's simplify: The wheel rotated `currentRotation`.
    // The pointer is static at top.
    // Effectively we check the angle at 270 degrees (1.5 PI) minus rotation.

    let pointerAngle = (1.5 * Math.PI - normalizedRotation) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    const index = Math.floor(pointerAngle / sliceAngle);
    selectedPlayer = players[index];

    showRevealModal(selectedPlayer);
}

function showRevealModal(player) {
    revealedPlayerName.innerText = player.name;
    revealedPlayerImg.src = player.image;
    playerRevealModal.classList.remove('hidden');
    bidAmountInput.value = '';
}

confirmSellBtn.addEventListener('click', () => {
    const teamName = buyerTeamSelect.value;
    const amount = parseFloat(bidAmountInput.value);

    if (!teamName || !amount) {
        alert('Please select a team and enter amount');
        return;
    }

    const team = appState.setup.teams.find(t => t.name === teamName);
    if (team.spent + amount > appState.setup.teamFund) {
        alert('Insufficient funds!');
        return;
    }

    // Execute Sale
    team.spent += amount;
    team.players.push(selectedPlayer);

    // Move player
    appState.players.all = appState.players.all.filter(p => p.id !== selectedPlayer.id);
    selectedPlayer.status = 'sold';
    selectedPlayer.soldTo = teamName;
    selectedPlayer.soldPrice = amount;
    appState.players.sold.push(selectedPlayer);

    // History
    appState.history.push({
        player: selectedPlayer.name,
        team: teamName,
        amount: amount,
        status: 'Sold'
    });

    saveState();
    playerRevealModal.classList.add('hidden');
    initWheel(); // Redraw wheel without sold player
    alert(`Congratulations! ${selectedPlayer.name} sold to ${teamName}!`);
});

markUnsoldBtn.addEventListener('click', () => {
    appState.players.all = appState.players.all.filter(p => p.id !== selectedPlayer.id);
    selectedPlayer.status = 'unsold';
    appState.players.unsold.push(selectedPlayer);

    appState.history.push({
        player: selectedPlayer.name,
        team: '-',
        amount: 0,
        status: 'Unsold'
    });

    saveState();
    playerRevealModal.classList.add('hidden');
    initWheel();
});

// --- Section 4: Expenses ---
function renderDashboard() {
    teamsDashboard.innerHTML = '';
    const fund = appState.setup.teamFund;

    appState.setup.teams.forEach(team => {
        const remaining = fund - team.spent;
        const width = (team.spent / fund) * 100;

        const div = document.createElement('div');
        div.className = 'team-card';
        div.innerHTML = `
            <h3>${team.name}</h3>
            <div class="stat-row">
                <span>Total Fund:</span>
                <span class="stat-value">${fund.toLocaleString()}</span>
            </div>
            <div class="stat-row">
                <span>Spent:</span>
                <span class="stat-value" style="color: var(--danger-color)">${team.spent.toLocaleString()}</span>
            </div>
            <div class="stat-row">
                <span>Remaining:</span>
                <span class="stat-value" style="color: var(--success-color)">${remaining.toLocaleString()}</span>
            </div>
            <div style="width: 100%; background: rgba(255,255,255,0.1); height: 10px; border-radius: 5px; margin-top: 10px; overflow: hidden;">
                <div style="width: ${width}%; background: var(--accent-color); height: 100%;"></div>
            </div>
            <p style="margin-top: 10px; font-size: 0.8rem; color: #ccc;">Players Bought: ${team.players.length}</p>
        `;
        teamsDashboard.appendChild(div);
    });
}

// --- Section 5: Reports ---
function renderReports() {
    reportsBody.innerHTML = '';
    appState.history.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.player}</td>
            <td>${item.team}</td>
            <td>${item.amount.toLocaleString()}</td>
            <td>${item.status}</td>
        `;
        reportsBody.appendChild(tr);
    });
}

exportCsvBtn.addEventListener('click', () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Player,Team,Amount,Status\n";

    appState.history.forEach(item => {
        csvContent += `${item.player},${item.team},${item.amount},${item.status}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "auction_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Initial Load
if (appState.setup.teams.length > 0) {
    // Populate form if data exists
    document.getElementById('trophy-name').value = appState.setup.trophyName;
    document.getElementById('total-players').value = appState.setup.totalPlayers;
    document.getElementById('team-fund').value = appState.setup.teamFund;

    // Clear default input
    teamsContainer.innerHTML = '';
    appState.setup.teams.forEach(team => {
        const div = document.createElement('div');
        div.className = 'team-input-group';
        div.innerHTML = `<input type="text" class="team-name" value="${team.name}" required>`;
        teamsContainer.appendChild(div);
    });

    renderPlayers();
}
