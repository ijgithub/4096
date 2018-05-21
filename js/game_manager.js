function GameManager(size, targetTile, tilesToAdd, inputManager, Actuator, ScoreManager) {
  this.size = size; // Size of the grid
  this.inputManager = inputManager;
  this.scoreManager = new ScoreManager;
  this.actuator = new Actuator;
  this.undoBuffer = [];

  this.startTiles = tilesToAdd;
  this.targetTile = targetTile;
  this.tilesToAdd = tilesToAdd;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("undo", this.undo.bind(this));

  this.setup();

  return this;
}

// Restart the game
GameManager.prototype.restart = function () {
  this.scoreManager.setState(false);
  this.actuator.continue();
  this.setup();
};

// Keep playing after winning
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continue();
};

GameManager.prototype.isGameTerminated = function () {
  if (this.over || (this.won && !this.keepPlaying)) {
    return true;
  } else {
    return false;
  }
};

// Set up the game
GameManager.prototype.setup = function () {
  var lastStateJsonStr = this.scoreManager.getState();
  var lastState = JSON.parse(lastStateJsonStr);
  this.grid = new Grid(this.size);

  var maxValue = 0;

  if (lastState.grid) {
    lastState.grid.cells.forEach(function (row) {
      row.forEach(function (cell) {
        if (cell === null) return;

        maxValue = maxValue < cell.value ? cell.value : maxValue;

        var tile = new Tile({ x: cell.x, y: cell.y }, cell.value);
        tile.previousPosition = cell.previousPosition;
        tile.mergedFrom = cell.mergedFrom;

        this.grid.insertTile(tile);
      }, this);

    }, this);
  }

  this.score = lastState.currentScore || 0;
  this.over = false;
  this.won = false;
  this.keepPlaying = false;
  this.undoBuffer = lastState.undoBuffer || [];

  if (maxValue >= 4096) {
    this.won = true;
    this.keepPlaying = true;
    this.actuator.continue();
  }

  if (!this.movesAvailable()) {
    this.won = false;
    this.keepPlaying = false;
    this.over = true;
    this.scoreManager.setState(false);
  }

  if (!lastState.grid) {
    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
    return true;
  } else {
    return false;
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.scoreManager.get() < this.score) {
    this.scoreManager.set(this.score);
  }

  this.actuator.actuate(this.grid, {
    score: this.score,
    over: this.over,
    won: this.won,
    bestScore: this.scoreManager.get(),
    terminated: this.isGameTerminated()
  });
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2:down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var gridClone = JSON.parse(JSON.stringify(this.grid));
  if (this.undoBuffer.length === 10) {
    this.undoBuffer.shift();
  }
  this.undoBuffer.push({
    score: this.score,
    grid: gridClone
  });

  var cell, tile;

  var vector = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty targetTile tile
          if (merged.value === self.targetTile) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    for (var i = 0; i < this.tilesToAdd; ++i) {
      if (!this.addRandomTile()) {
        break;
      }
    }
  }

  if (!this.movesAvailable()) {
    this.over = true; // Game over!
    this.scoreManager.setState(false);
  }

  this.actuate();

  this.saveGameState();
};

GameManager.prototype.undo = function () {
  if (this.undoBuffer.length === 0) return;
  this.grid = new Grid(this.size);
  var lastState = this.undoBuffer.pop();

  lastState.grid.cells.forEach(function (row) {
    row.forEach(function (cell) {
      if (cell === null) return;
      var tile = new Tile({ x: cell.x, y: cell.y }, cell.value);
      tile.previousPosition = cell.previousPosition;
      tile.mergedFrom = cell.mergedFrom;

      this.grid.insertTile(tile);
    }, this);

  }, this);

  this.score = lastState.score;

  this.actuate();

  // save game state to store undo buffer
  this.saveGameState();
};

GameManager.prototype.saveGameState = function () {
  var state = {
    currentScore: this.score,
    grid: this.grid,
    undoBuffer: this.undoBuffer
  };

  this.scoreManager.setState(state);
};

GameManager.prototype.restoreGameState = function () {
  var stateJsonStr = this.scoreManager.getState();
  var state = JSON.parse(stateJsonStr);



  this.scoreManager.setState(state);
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0, y: -1 }, // up
    1: { x: 1, y: 0 },  // right
    2: { x: 0, y: 1 },  // down
    3: { x: -1, y: 0 }   // left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
    this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell = { x: x + vector.x, y: y + vector.y };

          var other = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
