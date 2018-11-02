// npx uglifyjs striker.js striker-proxy.js -c -m -o striker.all.min.js
'use strict';
var tools = {
  isfn: function (val) { return typeof val === 'function'; },
  oapply: function (obj, ref) {
    obj = obj || {};
    for (var k in ref) if (k[0] !== '_') obj[k] = ref[k];
    return obj;
  },
  rapply: function (obj, ref) {
    if (!obj || !ref) return;
    for (var k in ref) if ('_$'.indexOf(k[0]) < 0) ref[k] = obj[k];
  },
  append: function (eParent, eChildren) {
    if (!eChildren.length || tools.isText(eChildren)) eChildren = [eChildren];
    while (eChildren.length > 0) {
      eParent.appendChild(eChildren[0]);
      if (eChildren instanceof Array) eChildren.shift();
    }
  },
  before: function (eRef, eChildren) {
    var eParent;
    if (!eChildren.length) eChildren = [eChildren];
    if ((eRef = tools.elCheck(eRef)) === undefined) return;
    if ((eParent = tools.elCheck(eRef.parentNode)) === undefined) return;
    while (eChildren.length > 0) {
      eParent.insertBefore(eChildren[0], eRef);
      if (eChildren instanceof Array) eChildren.shift();
    }
  },
  isElement: function (obj) { return obj instanceof Element; },
  isText: function (obj) { return obj instanceof Text; },
  isComment: function (obj) { return obj instanceof Comment; },
  isDocFrag: function (obj) { return obj instanceof DocumentFragment; },
  elHasAttribute: function (obj, name) {
    if (!tools.isElement(obj)) return false;
    if (typeof obj.hasAttribute !== 'function') return false;
    return obj.hasAttribute(name);
  },
  elCheck: function (el) {
    if (!el) return undefined;
    if (typeof el === 'string') el = document.querySelector(el);
    if (!tools.isElement(el) && !tools.isDocFrag(el) && !tools.isText(el))
      return undefined;
    if (el.content) el = el.content;

    return el;
  }
};

var mdl = {
  pathSplit: function (spath) {
    var rxSplit = /[.\[\]]+/g;
    if (spath instanceof Array) return spath;
    else if (typeof spath === 'string') return spath.split(rxSplit)
    else return [];
  },
  pathJoin: function () {
    var retval = [];
    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      if (arg instanceof Array) retval = retval.concat(arg);
      else if (arg === undefined) { }
      else retval.push(arg);
    }
    return retval.join('.');
  },
  dataPath: function (o, state, path) {
    path = mdl.pathSplit(path);

    // dig out of any ^ rabbit holes, and log full path
    var o2 = o, p2 = path.slice();
    while (p2.length && p2.indexOf('^') >= 0 && o2) o2 = o2[p2.shift()];
    var rp2 = o2['^p'], ri2 = o2['^i'];
    state._tracePath = mdl.pathJoin(rp2, ri2, p2);
    console.log('dataPath - ', state._tracePath);
    if (o2) { o = o2; path = p2; }

    var pfx = state && state.pfx instanceof Array ? state.pfx : [];

    var i0 = 0;
    if (path.length && !(path[0] in o)) {
      if (path[0] === '^^') { o = window; i0 = 1; }
      else if (path[0] === '^s') { o = state; i0 = 1; }
      else for (var j = 0; j < pfx.length; j++)
        if (path[0] in o[pfx[j]]) {
          path.unshift(pfx[j]);
          break;
        }
    }
    for (var i = i0; i < path.length; i++) {
      var p = path[i];
      if (p === '') break;
      var op = o[p];
      if (op !== undefined) o = op;
      else {
        console.warn('path "' + path.join('.') + '" not found in data');
        return '';
      }
    }
    return o;
  }

};

function Striker() {
  var t = this, modules = Striker.modules || [];

  modules.sort(function (a, b) { return a.rank - b.rank; });

  t.exec = function (e, data, removeParent, state) {
    if ((e = tools.elCheck(e)) === undefined) return;
    var e2 = e.cloneNode(true);
    t.traverse(e2, data, state);
    if (removeParent) {
      if (e2.childNodes.length == 1) return e2.firstChild;
      return e2.childNodes;
    }
    else return e2;
  };
  t.expend = function (eParent, e, data, removeParent, state) {
    if ((eParent = tools.elCheck(eParent)) === undefined) return;
    var e2 = t.exec(e, data, removeParent, state);
    tools.append(eParent, e2);
    return eParent;
  };

  t.traverse = function (e, data, refstate) {
    if (tools.isComment(e)) return e;
    // shallow copy state, but don't copy _* properties
    var state = tools.oapply({}, refstate);
    if ((e = tools.elCheck(e)) === undefined) return;

    if (tools.isText(e))
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
        if (tools.isfn(m.cbReplace)) robj[rkey] = robj[rkey]
          .replace(m.rx, m.cbReplace.bind(t, e, data, state, name));
        if (tools.isfn(m.cbMatch)) robj[rkey]
          .replace(m.rx, m.cbMatch.bind(t, e, data, state, name));
        if (tools.isfn(m.cbEval) && m.rx.test(robj[rkey]))
          m.cbEval.apply(t, [type, robj, rkey, e, data, state, name]);
        moduleCbFetch(m, 'cbChildren', robj[rkey], state);
        moduleCbFetch(m, 'cbCleanup', robj[rkey], state);
      }
    }
  }
  t.moduleEval = moduleEval;

  function moduleCbFetch(m, name, testval, state) {
    if (tools.isfn(m[name]) && m.rx.test(testval)) {
      if (!(state['_' + name] instanceof Array)) state['_' + name] = [];
      if (state['_' + name].indexOf(m[name]) < 0) state['_' + name].push(m[name]);
    }
  }

}


(function () {
  var cbAutoChange = function (data, path) {
    var o = data, p = path.slice();
    while (p.length > 1) o = o[p.shift()];
    o[p[0]] = this.value;
    console.log(data, path, this);
  };
  var modPath = {
    rank: 20,
    rx: /{{\s*(.+?)\s*}}/ig,
    apply: 'tv',
    cbReplace: function (e, data, state, name, all, spath) {
      var path = mdl.pathSplit(spath);
      var pfx = state.pfx;
      var o = mdl.dataPath(data, state, path);
      if (name !== '>' && typeof o === 'function' && tools.isElement(e)) {
        e.attributes.removeNamedItem(name);
        delete e[name];
        e.addEventListener(name.replace(/^on-?/i, ''), o.bind(e, data, path));
        o = '';
      }
      if (name === 'value' && !e.valueBindApplied && tools.elHasAttribute(e, 'value-bind')) {
        e.valueBindApplied = true;
        e.addEventListener('change', cbAutoChange.bind(e, data, path));
      }
      return o;
    }
  }
  var modFormula = {
    rank: 30,
    rx: /{\+{\s*((?:\n|.)+?)\s*}\+}/ig,
    apply: 'tv',
    cbReplace: function (e, data, state, name, all, fnbody) {
      var fn = (new Function('data, dp, event', fnbody))
        .bind(e, data, mdl.dataPath.bind(null, data, state));
      if (/^on-?/i.test(name)) {
        e.addEventListener(name.replace(/^on-?/i, ''), fn);
        return '';
      } else return fn();
    }
  }
  var modTemplate = {
    rank: 40,
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
    rank: 50,
    rx: /^data-page-(\d+)$/,
    apply: 'k',
    cbMatch: function (e, data, state, name, all, size) {
      var that = this;
      var pageSize = parseInt(size) || 999999;
      if (pageSize > 0) state._cbPaginate =
        function (fnLoopy, el, rarray) {
          var pageNext = fnLoopy(el, 0, pageSize);
          if (pageNext >= rarray.length) return;

          var ttag = tools.elCheck(name);
          if (!ttag) {
            ttag = document.createElement('a');
            ttag.textContent = 'Show more... (Showing: {{cur}} of {{ttl}})';
            ttag.href = '#'
            ttag.style.display = 'block';
          }
          var atag = that.exec(ttag, { cur: pageNext, ttl: rarray.length });
          tools.append(el, atag);
          atag.onclick = function (event) {
            if (state.stats) state.stats._reset = true;
            event.preventDefault();
            var ediv = document.createElement('div');
            pageNext = fnLoopy(ediv, pageNext, pageNext + pageSize);
            tools.before(atag, ediv);
            if (pageNext >= rarray.length) atag.remove();
            else {
              var tagContents = that.exec(ttag, { cur: pageNext, ttl: rarray.length }, true);
              atag.innerHTML = '';
              tools.append(atag, tagContents);
            }
            return false;
          };
        }
    }
  };

  var modPrefix = {
    rank: 60,
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
    rank: 70,
    rx: /^data-repeat-([^-]+)-?(.*)$/,
    apply: 'k',
    cbMatch: function (e, data, state, name, all, rname, rremove) {
      var path = mdl.pathSplit(name);
      var arr = mdl.dataPath(data, state, path);
      if (arr && arr.length) {
        state._rarray = arr;
        state._rpath = path;
        state._rname = rname;
        state._rremove = rremove;
        state._tmpOverride = true;
      }
    },
    cbChildren: function (e, data, state) {
      var that = this;
      var tmpName = state._tmpName, rarray = state._rarray, rpath = state._rpath,
        rname = state._rname, rremove = state._rremove, rdata;
      if (tmpName == null) {
        tmpName = e.cloneNode(true);
        while (tmpName.attributes.length > 0)
          tmpName.removeAttribute(tmpName.attributes[0].name);
      }
      e.innerHTML = '';
      var isPaginate = typeof state._cbPaginate === 'function';
      var fnLoopy = function (el, start, end) {
        for (var i = start; i < end; i++) {
          if (i >= rarray.length) break;
          (rdata = { '^': data, '^p': rpath, '^i': i })[rname] = rarray[i];
          that.expend(el, tmpName, rdata, true, state);
          if (isPaginate && tools.isfn(state.statAlert) && state.statAlert()) {
            i++;
            break;
          }
        }
        return i;
      }

      if (isPaginate) state._cbPaginate(fnLoopy, e, rarray);
      else fnLoopy(e, 0, rarray.length);

      if (rremove) {
        var newE = e.lastChild;
        tools.before(e, e.childNodes);
        e.remove();
        e = newE;
      }
    }
  };

  var modStats = {
    rank: 80,
    rx: /^./,
    apply: 'e',
    cbMatch: function (e, data, state) {
      var interval = 100;
      if (!('stats' in state)) {
        state._statFirst = true;
        state.stats = {};
        state.statAlert = function () {
          return s.tC - s.t0 > s.tick;
        };
      }
      var s = state.stats;
      if (!('t0' in s) || s._reset) {
        s.t0 = Date.now();
        delete s._reset;
      }
      if (!('count' in s)) s.count = 0;
      if (!('tick' in s)) s.tick = interval;

      s.tC = Date.now();
      s.count++;
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