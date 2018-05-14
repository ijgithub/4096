window.fakeStorage = {
  _data: {},

  setItem: function (id, val) {
    return this._data[id] = String(val);
  },

  getItem: function (id) {
    return this._data.hasOwnProperty(id) ? this._data[id] : undefined;
  },

  removeItem: function (id) {
    return delete this._data[id];
  },

  clear: function () {
    return this._data = {};
  }
};

function LocalScoreManager() {
  this.key     = "4096bestScore";
  this.currentScore         = "4096currentScore";
  this.currentBoardState    = "4096currentBoardState";

  var supported = this.localStorageSupported();
  this.storage = supported ? window.localStorage : window.fakeStorage;
}

LocalScoreManager.prototype.localStorageSupported = function () {
  var testKey = "test";
  var storage = window.localStorage;

  try {
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};

LocalScoreManager.prototype.get = function () {
  return this.storage.getItem(this.key) || 0;
};

LocalScoreManager.prototype.set = function (score) {
  this.storage.setItem(this.key, score);
};

LocalScoreManager.prototype.getState = function () {
  return this.storage.getItem(this.currentBoardState) || false;
};

LocalScoreManager.prototype.setState = function (state) {
  this.storage.setItem(this.currentBoardState, JSON.stringify(state));
};

LocalScoreManager.prototype.getCurrentScore = function() {
  return this.storage.getItem(this.currentScore) || 0;
}

LocalScoreManager.prototype.setCurrentScore = function(score) {
  this.storage.setItem(this.currentScore, score);
}
