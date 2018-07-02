'use strict';
function Striker() {
  var t = this, modules = Striker.modules || [];

  t.exec = function (e, data, removeParent, state) {
    if ((e = elCheck(e)) === undefined) return;
    var e2 = e.cloneNode(true);
    t.traverse(e2, data, state);
    if (removeParent) return e2.childNodes;
    else return e2;
  };
  t.append = function (eParent, eChildren) {
    if (!eChildren.length) eChildren = [eChildren];
    while (eChildren.length > 0) eParent.appendChild(eChildren[0]);
  };
  t.before = function (eRef, eChildren) {
    var eParent;
    if (!eChildren.length) eChildren = [eChildren];
    if ((eRef = elCheck(eRef)) === undefined) return;
    if ((eParent = elCheck(eRef.parentNode)) === undefined) return;
    while (eChildren.length > 0) eParent.insertBefore(eChildren[0], eRef);
  };
  t.expend = function (eParent, e, data, removeParent, state) {
    if ((eParent = elCheck(eParent)) === undefined) return;
    var e2 = t.exec(e, data, removeParent, state);
    t.append(eParent, e2);
    return eParent;
  };

  t.traverse = function (e, data, refstate) {
    // shallow copy state, but don't copy _* properties
    var state = {};
    for (var k in refstate) if (k[0] !== '_') state[k] = refstate[k];
    if ((e = elCheck(e)) === undefined) return;

    if (e.nodeName === '#text')
      moduleEval('t', e, 'nodeValue', e.parentNode, data, state, '>');

    if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
      var a = e.attributes[i];
      moduleEval('k', a, 'name', e, data, state, a.value);
      moduleEval('v', a, 'value', e, data, state, a.name);
    }

    var hadChildCb = moduleCbRun(state, '_cbChildren', [e, data, state]);
    if (!hadChildCb) { // default child functionality, if not overridden
      var ce = e.firstChild;
      while (ce != null) {
        ce = t.traverse(ce, data, state);
        if (ce == null) break;
        ce = ce.nextSibling;
      }
    }
    moduleCbRun(state, '_cbCleanup', [state]);
    return e;
  }

  function moduleCbRun(state, name, args) {
    if (state[name] && state[name].length) {
      for (var i = 0; i < state[name].length; i++) {
        state[name][i].apply(t, args);
      }
      return true;
    }
    else return false;
  }

  function moduleEval(type, robj, rkey, e, data, state, name) {
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      if (typeof m.apply !== 'string' || !(m.rx instanceof RegExp)) continue;
      if (m.apply.indexOf(type) >= 0) {
        if (isfn(m.cbReplace)) robj[rkey] = robj[rkey]
          .replace(m.rx, m.cbReplace.bind(t, e, data, state, name));
        if (isfn(m.cbMatch)) robj[rkey]
          .replace(m.rx, m.cbMatch.bind(t, e, data, state, name));
        moduleCbFetch(m, 'cbCleanup', robj[rkey], state);
        moduleCbFetch(m, 'cbChildren', robj[rkey], state);
      }
    }
  }

  function moduleCbFetch(m, name, testval, state) {
    if (isfn(m[name]) && m.rx.test(testval)) {
      if (!(state['_' + name] instanceof Array)) state['_' + name] = [];
      state['_' + name].push(m[name]);
    }
  }

  function elCheck(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!isElement(el) && !isDocFrag(el) && !isText(el)) return undefined;
    if (el.content) el = el.content;
    return el;
  };
  function isElement(obj) { return obj instanceof Element; }
  function isText(obj) { return obj instanceof Text; }
  function isDocFrag(obj) { return obj instanceof DocumentFragment; }
  function isfn(val) { return typeof val === 'function'; }
  t.isElement = isElement;
}

Striker.pathSplit = function (spath) {
  var rxSplit = /[.\[\]]+/g;
  if (spath instanceof Array) return spath;
  else if (typeof spath === 'string') return spath.split(rxSplit)
  else return [];
};
Striker.dataPath = function (o, path, pfx) {
  path = Striker.pathSplit(path);
  pfx = pfx instanceof Array ? pfx : [];
  if (path.length && !(path[0] in o)) {
    for (var j = 0; j < pfx.length; j++)
      if (path[0] in o[pfx[j]]) {
        path.unshift(pfx[j]);
        break;
      }
  }
  for (var i = 0; i < path.length; i++) {
    var p = path[i];
    if (p === '') break;
    if (o[p] !== undefined) o = o[p];
    else {
      console.warn('path "' + path.join('.') + '" not found in data');
      return '';
    }
  }
  return o;
};

(function () {
  var modPath = {
    rx: /{{\s*(.+?)\s*}}/ig,
    apply: 'tv',
    cbReplace: function (e, data, state, name, all, spath) {
      var path = Striker.pathSplit(spath);
      var pfx = state.pfx;
      var o = Striker.dataPath(data, path, pfx);
      if (name !== '>' && typeof o === 'function' && this.isElement(e)) {
        e.attributes.removeNamedItem(name);
        delete e[name];
        e.addEventListener(name.replace(/^on-?/i, ''), o.bind(e, data, path));
        o = '';
      }
      if (name === 'value' && this.isElement(e)) {
        e.addEventListener('change', (function (data, path) {
          var o = data, p = path.slice();
          while (p.length > 1) o = o[p.shift()];
          o[p[0]] = this.value;
          console.log(data, path, this);
        }).bind(e, data, path));
      }
      return o;
    }
  }
  var modFormula = {
    rx: /{\+{\s*((?:\n|.)+?)\s*}\+}/ig,
    apply: 'tv',
    cbReplace: function (e, data, state, name, all, fnbody) {
      var fn = (new Function('data, dp, event', fnbody))
        .bind(e, data, Striker.dataPath.bind(null, data));
      if (/^on-?/i.test(name)) {
        e.addEventListener(name.replace(/^on-?/i, ''), fn);
        return '';
      } else return fn();
    }
  }
  var modTemplate = {
    rx: /^data-template$/,
    apply: 'k',
    cbMatch: function (e, data, state, name, all) {
      state._tmpName = name;
    },
    cbChildren: function (e, data, state) {
      if (state._tmpOverride) return;
      this.expend(e, state._tmpName, data, true, state);
    }
  };
  var modPrefix = {
    rx: /^data-prefix$/,
    apply: 'k',
    cbMatch: function (e, data, state, name, all) {
      if (!(state.pfx instanceof Array)) state.pfx = [];
      state.pfx.unshift(name);
    },
    cbCleanup: function (state) {
      state.pfx.shift();
    }
  };
  var modRepeat = {
    rx: /^data-repeat-([^-]+)-?(.*)$/,
    apply: 'k',
    cbMatch: function (e, data, state, name, all, rname, rremove) {
      var path = Striker.pathSplit(name);
      var arr = Striker.dataPath(data, path, state.pfx);
      if (arr && arr.length) {
        state._rarray = arr;
        state._rname = rname;
        state._rremove = rremove;
        state._tmpOverride = true;
      }
    },
    cbChildren: function (e, data, state) {
      var tmpName = state._tmpName, rarray = state._rarray,
        rname = state._rname, rremove = state._rremove, rdata;
      if (tmpName == null) {
        tmpName = e.cloneNode(true);
        while (tmpName.attributes.length > 0)
          tmpName.removeAttribute(tmpName.attributes[0].name);
      }
      e.innerHTML = '';
      for (var i = 0; i < rarray.length; i++) {
        (rdata = { '^': data })[rname] = rarray[i];
        this.expend(e, tmpName, rdata, true, state);
      }
      if (rremove) {
        var newE = e.lastChild;
        this.before(e, e.childNodes);
        e.remove();
        e = newE;
      }
    }
  };
  Striker.modules = [
    modPath,
    modFormula,
    modTemplate,
    modPrefix,
    modRepeat
  ];
})();

if (typeof module !== 'undefined' && module && module.exports) {
  Striker.webServer = require('./0ws');
  module.exports = Striker;
}