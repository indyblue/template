'use strict';
function Striker() {
  var t = this, modules = Striker.modules || [],
    sTemplate = 'data-template', sPrefix = 'data-prefix',
    rxSplit = /[.\[\]]+/g,
    rxRep = ;

  t.exec = function (e, data, removeParent, prefixes) {
    if ((e = elCheck(e)) === undefined) return;
    var e2 = e.cloneNode(true);
    traverse(e2, data, prefixes);
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
  t.expend = function (eParent, e, data, removeParent, prefixes) {
    if ((eParent = elCheck(eParent)) === undefined) return;
    var e2 = t.exec(e, data, removeParent, prefixes);
    t.append(eParent, e2);
    return eParent;
  };

  function moduleEval(type, robj, rkey, bthis, data, state, name) {
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      if ((m.apply || '').indexOf(type) >= 0) {
        if (typeof m.cbReplace === 'function') robj[rkey] = robj[rkey]
          .replace(m.rx, m.cbReplace.bind(bthis, data, state, name));
        if (typeof m.cbMatch === 'function') robj[rkey]
          .replace(m.rx, m.cbMatch.bind(bthis, data, state, name));
      }
    }
  }

  function traverse(e, data, state) {
    if (!state) state = {};
    if ((e = elCheck(e)) === undefined) return;

    if (e.nodeName === '#text')
      moduleEval('t', e, 'nodeValue', e.parentNode, data, state, '>');

    if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
      var a = e.attributes[i];
      if (a.name === sPrefix) prefixes = a.value.split(/,/g);
      else if (a.name === sTemplate) tmpName = a.value;
      else {
        moduleEval('k', a, 'key', e, data, state, a.value);
        moduleEval('v', a, 'value', e, data, state, a.name);
      }
    }

    if (rarray && rarray.length) {
      if (tmpName === null) {
        tmpName = e.cloneNode(true);
        while (tmpName.attributes.length > 0)
          tmpName.removeAttribute(tmpName.attributes[0].name);
      }
      e.innerHTML = '';
      for (var i = 0; i < rarray.length; i++) {
        (rdata = { '^': data })[rname] = rarray[i];
        t.expend(e, tmpName, rdata, true, prefixes);
      }
      if (rremove) {
        var newE = e.lastChild;
        t.before(e, e.childNodes);
        e.remove();
        e = newE;
      }
    } else {
      if (tmpName !== null) t.expend(e, tmpName, data, true, prefixes);
      else {
        var ce = e.firstChild;
        while (ce != null) {
          ce = traverse(ce, data, prefixes);
          if (ce == null) break;
          ce = ce.nextSibling;
        }
      }
    }
    return e;
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
}

Striker.dataPath = function (o, path, pfx) {
  if (typeof path === 'string') path = path.split(rxSplit);
  pfx = (typeof pfx === 'string' ? pfx.split(',') : pfx) || '';
  for (var i = 0; i < path.length; i++) {
    var p = path[i];
    if (p === '') break;
    if (i === 0 && o[p] === undefined) for (var j = 0; j < pfx.length; j++)
      if (o[pfx[j]][p] !== undefined) { o = o[pfx[j]]; break; }
    if (o[p] !== undefined) o = o[p];
    else {
      console.warn('path "' + path.join('.') + '" not found in data');
      return '';
    }
  }
  return o;
}

  (function () {
    var modPath = {
      rx: /{{\s*((?:\n|.)+?)\s*}}/ig,
      apply: 'tv',
      cbMatch: function (data, state, name, all, spath) {
        var path = (typeof spath === 'string') ? spath.split(rxSplit) : spath;
        var pfx = state.pfx;
        pfx = (typeof pfx === 'string' ? pfx.split(',') : pfx) || '';
        var e = this, o = Striker.dataPath(data, path, pfx);
        if (name !== '>' && typeof o === 'function' && isElement(e)) {
          e.attributes.removeNamedItem(name);
          delete e[name];
          e.addEventListener(name.replace(/^on-?/i, ''), o.bind(e, data, path));
          o = '';
        }
        if (name === 'value' && isElement(e)) {
          e.addEventListener('change', (function (data, path) {
            var o = data, p = path.slice();
            while (p.length > 1) o = o[path.shift()];
            o[path[0]] = this.value;
            console.log(data, path, this);
          }).bind(e, data, path));
        }
        return o;
      }
    }
    var modFormula = {
      rx: /{!{\s*((?:\n|.)+?)\s*}!}/ig,
      apply: 'tv',
      cbMatch: function (data, state, name, all, fnbody) {
        var fn = (new Function('data, dp, event', fnbody))
          .bind(this, data, Striker.dataPath.bind(null, data));
        if (/^on-?/i.test(name)) {
          e.addEventListener(name.replace(/^on-?/i, ''), fn);
          return '';
        } else return fn();
      }
    }
    var modRepeat = {
      rx: /^data-repeat-([^-]+)-?(.*)$/,
      apply: 'k',
      cbMatch: function (data, state, name, all, rname, rremove) {
        var arr = Striker.dataPath(data, name, state.pfx);
        if (arr && arr.length) {
          state.rarray = arr;
          state.rname = rname;
          state.rremove = rremove;
        }
      }
    };
    Striker.modules = [
      modPath,
      modFormula,
      modRepeat
    ];
  })();

if (module && module.exports) {
  Striker.webServer = require('./0ws');
  module.exports = Striker;
}
