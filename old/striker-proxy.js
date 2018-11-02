'use strict';
var deepProxy;

(function () { //closure to keep vars out of global
	if (typeof Proxy !== 'function') {
		deepProxy = function (d) { return d; };
		return; // if browser doesn't support Proxy, do nothing
	}
	//tracking variables
	var _getCb = null, _setCb = null,
		_track = {},
		_fnTrackAdd = function (key, obj) {
			if (!(_track[key] instanceof Array)) _track[key] = [];
			var tk = _track[key], eobj = false;
			for (i = 0; i < tk.length; i++) {
				if (tk[i].robj === obj.robj && tk[i].rkey === obj.rkey) {
					eobj = i;
					break;
				}
			}
			if (eobj === false) _track[key].push(obj);
		};

	//main recursive Proxy implementation
	deepProxy = function (obj, path) {
		path = path || ['!'];
		var handler = {
			get: function (target, key) {
				if (key === '__isProxy') return true;
				if (key === '__getTrack') return _track;
				var fullPath = path.join('.') + '.' + key;
				var tk = target[key], ttk = typeof tk;
				if (ttk === 'object' && tk != null) {
					return deepProxy(tk, path.concat([key]));
				} else if (ttk === 'function') {
					return tk;
				} else if (tk !== undefined) {
					if (isFn(_getCb)) _getCb(fullPath, target, key, tk);
					return tk;
				}
			},
			set: function (target, key, value) {
				if (key === '__proxyGetCallback' && isFn(value)) _getCb = value;
				if (key === '__proxySetCallback' && isFn(value)) _setCb = value;
				var fullPath = path.join('.') + '.' + key;
				target[key] = value;
				if (isFn(_setCb)) _setCb(fullPath, target, key, value);
				return true;
			}
		};
		return new Proxy(obj, handler);
	}
	function isFn(a) { return typeof a === 'function'; }

	// Striker module
	var modProxy = {
		rank: 10,
		rx: /^./,
		apply: 'vt',
		cbEval: function (type, robj, rkey, e, data, state, name) {
			var that = this;
			var origVal = robj[rkey];
			_getCb = function (fullPath, target, key, value) {
				_fnTrackAdd(fullPath, {
					moduleEval: that.moduleEval, type: type, robj: robj, rkey: rkey,
					e: e, data: data, state: state, name: name, origVal: origVal
				});
			};

			//only needs to be set once, doesn't rely on any changing params in cbEval
			if (!isFn(_setCb)) _setCb = function (fullPath, target, key, value) {
				var objs = _track[fullPath];
				if (!(objs instanceof Array)) return;
				for (var i = 0; i < objs.length; i++) {
					var o = objs[i];
					var val0 = o.robj[o.rkey];
					o.robj[o.rkey] = o.origVal;
					o.moduleEval(o.type, o.robj, o.rkey, o.e, o.data, o.state, o.name);
					// if replace failed, set back to original
					if (o.robj[o.rkey] == o.origVal) o.robj[o.rkey] = val0;
				};
			}
		},
		cbCleanup: function () {
			_getCb = null; // only needed for the duration of the traverse()
		}
	};

	// if Striker exists, unshift. This module should be ahead of all others.
	if (typeof Striker === 'function' && Striker.modules instanceof Array)
		Striker.modules.unshift(modProxy);
})();
