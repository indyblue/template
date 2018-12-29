usage:
```
var tmp = new Templar('#parent', '#main.template', data, ctx);
var generatedElementOrFrag = tmp.exec(); // generate new element, append to "parent"
data.someValue = 4;
tmp.recalc(); // refresh generated HTML, only changing DOM when necessary.
```
* #parent: this can be any valid querySelector string or a DOM Element
  * optional, if it doesn't resolve to a valid element it won't be appended anywhere
* #main.template: same as above, not optional
* data: should be provided, but can be set/changed after the fact using `tmp.model`
* ctx: optional
  * ctx.model: always part of every context. root cannot be changed/overwritten here
    * read-only, but mutable: 
    * i.e. you can't do `ctx.model = {}`, but you can do `ctx.model.a = {}`.
    * can be changed using `ist.model` though
  * ctx.ist: Templar instance. also read-only but mutable.
  * new ctx is created for each element when traversing the template DOM
    * _props: not propagated to children, will only exist in ctx for that element
    * $props: propagated to children, and also sent back to parent
    * props: propagated to children, but not to parent
    * props which contain strings beginning with 'model.':
      * assumed to be aliases for a model path, 
      * will attempt to "expand" them into model
      * this is normally done automatically via x-model or x-repeat

attributes:
* value-bind - add change event to value
* (data-|x-)model-xxx - alias. specify a path, or defaults to last model (or root)
* (data-|x-)(template|tmp) - value should resolve to an element to use as template
* (data-|x-)repeat-xxx - repeat over array. specify array and model alias

patterns:
* double curlies: {{ ... }}
* starts at the ctx level
* main data model is always "model"
* when repeating or using model-xxx, you can create aliases for any part or all of the data model.
* aliases can only be created for model.

event:
* can either be standard attribute (e.g. onclick) or dashed (e.g. on-click)
* dashed is best for old browsers without proper template tag support
* args: ctx, path, qq, event
* expects cb function to exist within the ctx
{?:{}} - dynamic functions
* {?{...}} = block style, need explicit return
* {:{...}} = single-line auto-return style
* better to use pattern pointers, since dynamic functions can't be precompiled. They are quite a bit slower.
* args: ctx, qq, event

DOM monitoring:
* attribute patterns are always monitored
* isSingleTextChild: monitored, uses innerHTML, so can contain html
* other text nodes: not monitored, uses nodeValue, so only supports plain text
* repeats:
  * if standard array index mode:
    * domMon will only check number of nodes
    * relies on regular domMon to morph existing nodes in case of reorder
    * this could be very inefficient with multi-level repeating patterns
  * keyed mode: object with unique key. 
    * format: x-repeat-i='model.array.=key'
    * =key: the property name for the unique key
    * during the repeat cycle, this will be replaced with 'i=key=value'
    * domMon will add/remove/reorder elements associated with nodes


debug flags: (ctx.debug, bitfield, so add together
* 1: node
* 2: text
* 4: attr
* 8: eval
* 16: repeat
* 32: domMon



specs: (at last count)
* 25.6kB total
* 13.9kB minified
* 5.2kB min/gz

- originally based on the concept of stamp by J Gregorio https://github.com/jcgregorio/stamp