'use strict';
function Striker() {
  var t = this, modules = Striker.modules || [];

  t.exec = function (e, data, removeParent, state) {
    if ((e = elCheck(e)) === undefined) return;
    var e2 = e.cloneNode(true);
    t.traverse(e2, data, state);
    if (removeParent) {
      if (e2.childNodes.length == 1) return e2.firstChild;
      return e2.childNodes;
    }
    else return e2;
  };
  t.append = function (eParent, eChildren) {
    if (!eChildren.length || isText(eChildren)) eChildren = [eChildren];
    while (eChildren.length > 0) {
      eParent.appendChild(eChildren[0]);
      if (eChildren instanceof Array) eChildren.shift();
    }
  };
  t.before = function (eRef, eChildren) {
    var eParent;
    if (!eChildren.length) eChildren = [eChildren];
    if ((eRef = elCheck(eRef)) === undefined) return;
    if ((eParent = elCheck(eRef.parentNode)) === undefined) return;
    while (eChildren.length > 0) {
      eParent.insertBefore(eChildren[0], eRef);
      if (eChildren instanceof Array) eChildren.shift();
    }
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

    if (isText(e))
      moduleEval('t', e, 'nodeValue', e.parentNode, data, state, '>');

    if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
      var a = e.attributes[i];
      moduleEval('k', a, 'name', e, data, state, a.value);
      moduleEval('v', a, 'value', e, data, state, a.name);
    }

    moduleEval('e', e, 'nodeName', e, data, state, '<>');

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
        moduleCbFetch(m, 'cbChildren', robj[rkey], state);
        moduleCbFetch(m, 'cbCleanup', robj[rkey], state);
      }
    }
  }

  function moduleCbFetch(m, name, testval, state) {
    if (isfn(m[name]) && m.rx.test(testval)) {
      if (!(state['_' + name] instanceof Array)) state['_' + name] = [];
      if (state['_' + name].indexOf(m[name]) < 0) state['_' + name].push(m[name]);
    }
  }

  function elCheck(el) {
    if (!el) return undefined;
    if (typeof el === 'string') el = document.querySelector(el);
    if (!isElement(el) && !isDocFrag(el) && !isText(el)) return undefined;
    if (el.content) el = el.content;
    
    if (isDocFrag(el)){
      var srcEl = elSingleRealChild(el);
      if(srcEl) return srcEl;
    }
    return el;
  };
  function elSingleRealChild(el) {
    var firstRealChild = null;
    var ce = el.firstChild;
    while (ce != null) {
      if (isText(ce) && /^\s+$/.test(ce.nodeValue)) { }
      else if (!firstRealChild) firstRealChild = ce;
      else return null;
      ce = ce.nextSibling;
    }
    return firstRealChild;
  }
  function isElement(obj) { return obj instanceof Element; }
  function isText(obj) { return obj instanceof Text; }
  function isDocFrag(obj) { return obj instanceof DocumentFragment; }
  function isfn(val) { return typeof val === 'function'; }
  t.isElement = isElement;
  t.elCheck = elCheck;
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
  var modPaginate = {
    rx: /^data-page-(\d+)$/,
    apply: 'k',
    cbMatch: function (e, data, state, name, all, size) {
      var that = this;
      var pageSize = parseInt(size);
      if (pageSize > 0) state._cbPaginate =
        function (fnLoopy, el, rarray) {
          fnLoopy(el, 0, pageSize);
          var pageNext = pageSize;

          var ttag = that.elCheck(name);
          if (!ttag) {
            ttag = document.createElement('a');
            ttag.textContent = 'Show more... (Showing: {{cur}} of {{ttl}})';
            ttag.href = '#'
            ttag.style.display = 'block';
          }
          var atag = that.exec(ttag, { cur: pageNext, ttl: rarray.length });
          that.append(el, atag);
          atag.onclick = function (event) {
            event.preventDefault();
            var ediv = document.createElement('div');
            fnLoopy(ediv, pageNext, pageNext + pageSize);
            that.before(atag, ediv);
            pageNext += pageSize;
            if (pageNext >= rarray.length) atag.remove();
            else {
              var tagContents = that.exec(ttag, { cur: pageNext, ttl: rarray.length }, true);
              atag.innerHTML = '';
              that.append(atag, tagContents);
            }
            return false;
          };
        }
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
      var that = this;
      var tmpName = state._tmpName, rarray = state._rarray,
        rname = state._rname, rremove = state._rremove, rdata;
      if (tmpName == null) {
        tmpName = e.cloneNode(true);
        while (tmpName.attributes.length > 0)
          tmpName.removeAttribute(tmpName.attributes[0].name);
      }
      e.innerHTML = '';
      var fnLoopy = function (el, start, end) {
        for (var i = start; i < end; i++) {
          if (i >= rarray.length) break;
          (rdata = { '^': data })[rname] = rarray[i];
          that.expend(el, tmpName, rdata, true, state);
        }
      }

      if (typeof state._cbPaginate === 'function')
        state._cbPaginate(fnLoopy, e, rarray);
      else fnLoopy(e, 0, rarray.length);

      if (rremove) {
        var newE = e.lastChild;
        that.before(e, e.childNodes);
        e.remove();
        e = newE;
      }
    }
  };

  var modStats = {
    rx: /^./,
    apply: 'e',
    cbMatch: function (e, data, state) {
      var interval = 100;
      if (!('stats' in state)) {
        state._statFirst = true;
        state.stats = {};
      }
      var s = state.stats;
      if (!('t0' in s)) s.t0 = Date.now();
      if (!('count' in s)) s.count = 0;
      if (!('tick' in s)) s.tick = interval;

      s.tC = Date.now();
      s.count++;
      if (s.tC - s.t0 > s.tick) {
        state._statFirst = true;
        s.tick = s.tC - s.t0 + interval;
      }
    },
    cbCleanup: function (state) {
      if (state._statFirst) {
        var s = state.stats;
        console.log('stats', 'time', s.tC - s.t0, 'count', s.count);
      }
    }
  };

  Striker.modules = [
    modPath,
    modFormula,
    modTemplate,
    modPaginate,
    modPrefix,
    modRepeat,
    modStats
  ];
})();

if (typeof module !== 'undefined' && module && module.exports) {
  Striker.webServer = require('./0ws');
  module.exports = Striker;
}