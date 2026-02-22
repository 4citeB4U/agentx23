const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gridSize = 20;
const gridWidth = canvas.width / gridSize;
const gridHeight = canvas.height / gridSize;

let pacmanX = 1; // Initial Pac-Man X position (grid units)
let pacmanY = 1; // Initial Pac-Man Y position (grid units)
let pacmanSpeed = 1; // Units per frame

let score = 0;

// Represent the game grid: 0 = empty, 1 = wall, 2 = dot
let grid = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
    [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
    [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];


// Keyboard input handling
let dx = 0;  // -1 left, 1 right, 0 none
let dy = 0;  // -1 up, 1 down, 0 none

document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'w':
            dx = 0;
            dy = -1;
            break;
        case 's':
            dx = 0;
            dy = 1;
            break;
        case 'a':
            dx = -1;
            dy = 0;
            break;
        case 'd':
            dx = 1;
            dy = 0;
            break;
    }
});


function drawGrid() {
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            if (grid[row][col] === 1) {  // Wall
                ctx.fillStyle = 'blue';
                ctx.fillRect(col * gridSize, row * gridSize, gridSize, gridSize);
            } else if (grid[row][col] === 2) { // Dot
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(col * gridSize + gridSize / 2, row * gridSize + gridSize / 2, gridSize / 4, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
}

function drawPacman() {
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(pacmanX * gridSize + gridSize / 2, pacmanY * gridSize + gridSize / 2, gridSize / 2, 0, 2 * Math.PI);
  ctx.fill();
}

function update() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update Pac-Man position
    let newPacmanX = pacmanX + dx * pacmanSpeed;
    let newPacmanY = pacmanY + dy * pacmanSpeed;

    // Collision detection with walls
    if (grid[newPacmanY][newPacmanX] !== 1) {
        pacmanX = newPacmanX;
        pacmanY = newPacmanY;
    }

    // Eat dots
    if (grid[pacmanY][pacmanX] === 2) {
        grid[pacmanY][pacmanX] = 0; // Remove dot
        score++;
    }

    // Draw everything
    drawGrid();
    drawPacman();

    // Display score
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText('Score: ' + score, 10, 20);

    // Request the next frame
    requestAnimationFrame(update);
}

// Start the game loop
update();
