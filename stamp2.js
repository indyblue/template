'use strict';
function Template(el) {
	if(!isElement(el)
		&& !isDocumentFragment(el)) return null;
	if(el.content) el = el.content;
	var rv = this;
	rv.element = el.cloneNode(true);
	rv.patterns = [];
	rv.repeats = [];
	var rxMus = /{{\s*([^ \t}]+)\s*}}/ig;
	var rxRep = /^data-repeat-([^-]+)-?.*$/;
	var rxSplit = /[.\[\]]+/g;

	/*****************************************************************/
	// helper functions
	/*****************************************************************/
	function isElement(obj) { return obj instanceof Element; }
	function isDocumentFragment(obj) { return obj instanceof DocumentFragment; }
	function uMatches(rx, str, pat) {
		if(pat===undefined) pat=-1;
		if(!rx.global) {
			console.error('rx no global flag! recompiling...', rx.source)
			rx = new RegExp(rx.source, rx.flags+'g');
		}
		var am = [], m=rx.exec(''), i=0;
		while(i<100 && (m=rx.exec(str)) !== null) {
			am.push(pat<0?m:m[pat]);
			i++;
		}
		return am;
	}
	function oMatches(rx, str, kv, sv) {
		var matches = uMatches(rx, str);
		if(matches.length===0) return null;
		if(kv===undefined) kv =[0,1];
		if(sv===undefined) sv = true;
		var k=kv[0], v=kv[1], obj = {};
		for(var i=0;i<matches.length;i++){
			var m = matches[i];
			if(!obj[m[k]]) obj[m[k]] = sv?m[v].split(rxSplit):m[v];
		}
		return obj;
	}
	function newPat(path, str) {
		var m = oMatches(rxMus, str);
		if(m===null) return null;
		return { pattern: path, replace: m };
	}
	function pcon(path, v) {
		if(v===undefined) v=null;
		if(v===null) return path.concat('nodeValue');
		else return path.concat('attributes', v, 'value');
	}

	/*****************************************************************/
	// initialize pattern/repeat arrays
	/*****************************************************************/
	(function findElementPatterns(e, aPat, aRep, path) {
		if(path===undefined) path=[];
		var np=null;
		//console.log(e.tagName||e.nodeName);
		if(e.nodeName==='#text' && (np=newPat(pcon(path), e.nodeValue))!==null)
			aPat.push(np);
		//if(e.nodeName==='#text') console.log('nodeValue', e.nodeValue);

		var tmpPath=path, tmpPat=aPat, tmpRep=aRep;
		if(e.attributes) for(var i=0;i<e.attributes.length;i++){
			var a = e.attributes[i];
			//console.log('attr', a.name, a.value);
			if((np=newPat(pcon(path,a.name),a.value))!==null)
				aPat.push(np);
			if((np=rxRep.exec(a.name))!==null) {
				tmpPat=[]; tmpRep=[]; tmpPath=[];
				aRep.push({
					pattern: path.concat('attributes', a.name, 'value'),
					value: a.value,
					base: np[1],
					element: path,
					patterns: tmpPat,
					repeats: tmpRep
					//template: new Template(e, false)
				});
			}
		}
		for(var i=0;i<e.childNodes.length;i++) {
			var c = e.childNodes[i];
			findElementPatterns(c, tmpPat, tmpRep, tmpPath.concat('childNodes',i));
		}
	})(rv.element, rv.patterns, rv.repeats);

	/*****************************************************************/
	// worker methods
	/*****************************************************************/
	rv.newel = function(e) {
		if(Array.isArray(e)) e = rv.eval(rv.element, e);
		return e.cloneNode(true);
	};
	rv.eval = function(path, data, opts) {
		if(opts===undefined) opts = {k:'',v:''};
		var apath = path;
		if(typeof apath==='string') apath = path.split(rxSplit);
		var o = data;
		for(var i=0;i<apath.length;i++){
			var p = apath[i];
			if(i===apath.length-3 && isElement(o) && typeof opts.v==='function') {
				var ename = apath[apath.length-2];
				o.attributes.removeNamedItem(ename);
				delete o[ename]
				return o.addEventListener(ename.substr(2), opts.v.bind(o, opts.k));
			} else if(i===apath.length-1 && typeof o[p]==='string' && opts.k!==''){
				if(typeof opts.v==='function') throw new Error("eval function - "
					+"should this be an event handler? " +p+' - '+apath.join('.'));
				else o[p] = o[p].replace(opts.k, opts.v);
			}
			else if(o[p]!==undefined) o = o[p];
			else throw new Error('eval - undefined '+p+' - '+path.join('.'));
		}
		return o;
	};
	rv.empty = function(el) {
		while(el.firstChild) el.removeChild(el.firstChild);
	};
	rv.exec = function(data, tmp, el) {
		if(tmp===undefined) tmp = rv;
		if(el===undefined) el = tmp.element;
		var newe = rv.newel(el);
		//console.log(tmp);
		for(var i=0;i<tmp.patterns.length;i++){
			var pat = tmp.patterns[i];
			var keys = Object.keys(pat.replace);
			for(var j=0;j<keys.length;j++){
				var k = keys[j];
				var v = rv.eval(pat.replace[k], data);
				//console.log(k, v);
				if(typeof v==='function') k = data;
				rv.eval(pat.pattern, newe, {k:k, v:v});
			}
		}
		for(var i=0;i<tmp.repeats.length;i++){
			var rep = tmp.repeats[i];
			var reps = [];
			var rdata = rv.eval(rep.value, data);
			var rel = rv.eval(rep.element, newe);
			for(var j=0;j<rdata.length;j++){
				var d = rdata[j];
				var o = {'^':data, '^i':j, '^v':rep.value };
				o[rep.base]=d;
				//console.log(rep.element, rep.value, o);
				reps.push(rv.exec(o, rep, rel));
			}
			rv.empty(rel);
			//console.log(reps.map(x=> x.childNodes));
			rv.append(rel, reps, true);
		}
		return newe;
	};
	rv.append = function(pe, els, children){
		if(children===undefined) children=false;
		if(!Array.isArray(els)) els = [els];
		for(var i=0;i<els.length;i++){
			var e = els[i];
			if(children || e.tagName==='TEMPLATE') while(e.firstChild) {
				pe.appendChild(e.firstChild);
			} else pe.appendChild(e);
		}
	}
}

