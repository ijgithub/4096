
function AiManager(gameManager, inputManager) {
    this.gm = gameManager;
    this.nextMoveNumber = 0;
    this.shouldStop = true;
    this.timeout = 1000;

    this.inputManager = inputManager;
    this.inputManager.on("restart", this.restart.bind(this));
    this.inputManager.on("start-ai", this.start.bind(this));
    this.inputManager.on("stop-ai", this.stop.bind(this));
    this.inputManager.on("update-mps", this.updateMps.bind(this));

    this.boundDoMove = this.doMove.bind(this);
}

AiManager.prototype.start = function () {
    this.shouldStop = false;

    if (this.gm.isGameTerminated()) return;
    setTimeout(this.boundDoMove, this.timeout);
}

AiManager.prototype.stop = function () {
    this.shouldStop = true;
}

const direction = {
    up: 0,
    right: 1,
    down: 2,
    left: 3
};

AiManager.prototype.doMove = function () {
    if (this.shouldStop) return;

    // inspect the grid and decide what move to play

    this.gm.move(this.nextMoveNumber);
    this.nextMoveNumber = this.nextMoveNumber === direction.left ? direction.right: direction.left;
    if (this.gm.isGameTerminated()) return;
    setTimeout(this.boundDoMove, this.timeout);
}

AiManager.prototype.restart = function () {
    if (this.gm.isGameTerminated()) return;
    setTimeout(this.boundDoMove, this.timeout);
}

AiManager.prototype.updateMps = function (value) {
    var newTimeout = 1000 / value;
    this.timeout = newTimeout;
}