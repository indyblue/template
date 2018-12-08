(function () {
  function nu(i) { return i !== undefined };
  function MapShim() {
    this._kv = [];
    return this;
  };
  var mprot = MapShim.prototype;
  mprot.size = function () { return this._kv.length };
  mprot._findi = function (key) {
    for (var i = 0; i < this._kv.length; i++) {
      if (this._kv[i].key === key) return i;
    }
  };
  mprot._find = function (key) {
    var i = this._findi(key);
    if (nu(i)) return this._kv[i];
  };
  mprot.get = function (key) {
    var obj = this._find(key);
    if (obj) return obj.value;
  };
  mprot.forEach = function (cb, thisArg) {
    cb = cb.bind(thisArg);
    for (var i = 0; i < this._kv.length; i++) {
      var obj = this._kv[i];
      cb(obj.value, obj.key, this);
    }
  }
  mprot.has = function (key) {
    return nu(this._findi(key));
  };
  mprot.set = function (key, value) {
    var obj = this._find(key);
    if (!obj) {
      obj = { key: key, value: undefined };
      this._kv.push(obj);
    }
    obj.value = value;
    return this;
  };
  mprot.delete = function (key) {
    var i = this._findi(key);
    if (nu(i)) {
      this._kv.splice(i, 1);
      return true;
    }
    return false;
  };
  if (!('Map' in window))
    window.Map = MapShim;
  else window.Map2 = MapShim;

  function DblMap() {
    this.map = new Map();
  };
  var dprot = DblMap.prototype;
  dprot.get = function (k1, k2) {
    var o1 = this.map.get(k1);
    if (!o1) return undefined;
    var o2 = o1.get(k2);
    return o2;
  };
  dprot.forEach = function (cb, thisArg) {
    var that = this;
    that.map.forEach(function (map2, k1) {
      map2.forEach(function (value, k2) {
        cb.bind(thisArg)(value, k1, k2, that);
      });
    });
  };
  dprot.has = function (k1, k2) {
    var o1 = this.map.get(k1);
    if (!o1) return false;
    return o1.has(k2);
  }
  dprot.set = function (k1, k2, value) {
    var o1 = this.map.get(k1);
    if (!o1) this.map.set(k1, o1 = new Map());
    o1.set(k2, value);
    return this;
  }
  dprot.delete = function (k1, k2) {
    var o1 = this.map.get(k1);
    if (!o1) return false;
    return o1.delete(k2);
  }
  window.DblMap = DblMap;
})();

// var t = new Map2();
// for (var i = 0; i < 5; i++) t.set(i, i * i);
// t.forEach((v, k) => { console.log('kv', k, v); });

// var q = new DblMap();
// for (var i = 0; i < 5; i++)
//   for (var j = 0; j < 5; j++)
//     q.set(i, j, { i, j });
// q.forEach((v, k1, k2) => { console.log('kkv', k1, k2, v); });
