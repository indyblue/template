//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
//https://stackoverflow.com/questions/49079437/deep-proxy-of-deep-nested-object-in-javascript#49079437

var deepProxy, proxyGets = [];
(function () {
	if (typeof Proxy !== 'function') {
		Proxy = function () { console.error('Proxy not implemented'); };
	}
	var _getCb = null, _setCb = null;
	deepProxy = function (obj, path) {
		path = path || ['!'];
		var handler = {
			get: function (target, key) {
				if (key === '__isProxy') return true;
				if (key === '__hasCBs') return isFn(_getCb) && isFn(_setCb);
				var fullPath = path.join('.') + '.' + key;
				var tk = target[key], ttk = typeof tk;
				if (ttk === 'object' && tk != null) {
					return deepProxy(tk, path.concat([key]));
				} else if (ttk === 'function') {
					return tk;
				} else if (tk !== undefined) {
					if (isFn(_getCb)) _getCb(fullPath, target, key, tk);
					//console.log(path.join('.') + '.' + key, '=', tk);
					proxyGets.push(fullPath + ' = ' + tk);
					return tk;
				}
			},
			set: function (target, key, value) {
				if (key === '__proxyGetCallback' && isFn(value)) _getCb = value;
				if (key === '__proxySetCallback' && isFn(value)) _setCb = value;
				var fullPath = path.join('.') + '.' + key;
				//console.log(path.join('.') + '.' + key, ':', target[key], '->', value);
				if (isFn(_setCb)) _setCb(fullPath, target, key, value);
				target[key] = value;
				return true;
			}
			// ,deleteProperty: function (target, key) {
			// 	console.log(path.join('.') + '.' + key, '[X]');
			// 	return delete target[key];
			// }
		};
		return new Proxy(obj, handler);
	}
	function isFn(a) { return typeof a === 'function'; }
})();
