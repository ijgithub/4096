// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  var keyboardInputManager = new KeyboardInputManager();
  var gameManager = new GameManager(5, 4096, 2, keyboardInputManager, HTMLActuator, LocalScoreManager);
  var aiManager = new AiManager(gameManager, keyboardInputManager);
});
