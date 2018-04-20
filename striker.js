'use strict';
function Striker() {
    var t = this, sTemplate = 'data-template', sPrefix = 'data-prefix',
        rxSplit = /[.\[\]]+/g, rxPat = /{{\s*([^ \t}]+)\s*}}/ig,
        rxRep = /^data-repeat-([^-]+)-?(.*)$/;

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
        if ((eParent = elCheck(eRef.parentElement)) === undefined) return;
        while (eChildren.length > 0) eParent.insertBefore(eChildren[0], eRef);
    };
    t.expend = function (eParent, e, data, removeParent, prefixes) {
        if ((eParent = elCheck(eParent)) === undefined) return;
        var e2 = t.exec(e, data, removeParent, prefixes);
        t.append(eParent, e2);
        return eParent;
    };

    function traverse(e, data, prefixes) {
        var tmpName = null, pat = null, rarray = null, rname, rdata,
            tmpName, rremove = false;
        if ((e = elCheck(e)) === undefined) return;
        if (e.nodeName === '#text') {
            var cb = cbPat.bind(e.parentNode, data, '>', prefixes);
            e.nodeValue = e.nodeValue.replace(rxPat, cb);
        }

        if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
            var a = e.attributes[i];
            if (a.name === sPrefix) prefixes = a.value.split(/,/g);
            else if (a.name === sTemplate) tmpName = a.value;
            else if ((pat = rxRep.exec(a.name)) !== null) {
                rname = pat[1];
                rarray = cbPat(data, '>', prefixes, '', a.value);
                if (pat[2] === 'remove') rremove = true;
            } else {
                var cb = cbPat.bind(e, data, a.name, prefixes);
                a.value = a.value.replace(rxPat, cb);
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
    function cbPat(data, name, pfx, all, path) {
        if (typeof path === 'string') path = path.split(rxSplit);
        var pfx = (typeof pfx === 'string' ? pfx.split(/,/g) : pfx) || '';
        var e = this, o = data;
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
        if (name !== '>' && typeof o === 'function' && isElement(e)) {
            e.attributes.removeNamedItem(name);
            delete e[name];
            e.addEventListener(name.replace(/^on-?/i, ''), o.bind(e, data));
            o = '';
        }
        return o;
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