# template
looks at an existing element (or template tag). 
* It will make a cloned copy of the element
* iterate through all attributes and childNodes looking for mustache patterns or data-repeat elements
* (elements it can't find it replaces with an empty string...probably need to either add a console message or change this behavior)

# new: modular design, with new features
modules:
  * basic path, splits on dots or square brackets, no quotes needed (e.g. {{q.ra.4.t}} and {{q.ra[4].t}} and {{q[ra][r][t]}} are all equivalent, and would all be the equivalent of `data.q.ra[4].t`.
    * this has basic event handler logic built-in. function can either be assigned to a variable in the data model, or could be inline using the formula module.
    * also an automatic "change" event if you have a path in a "value" attribute. for one-way binding back to model. (not sure if this should be disable-able)
  * formula (evaluates as multi-line function body, with params (data, dp, event) dp=dataParse, same as basic path. event=if it's an event handler
  * template: replace a tag's contents with another template
  * paginate: works with repeat to allow max number for initial display, and "Show more" in batches
    * can use custom template for "show more", and show more can display current/total values (updates when clicked)
  * prefix: works with repeat to add a prefix. this should mostly be useful in conjunction with template module, because you might be using a template that doesn't have your repeat variable designation.
  * repeat: repeating sections, associated with an array
    * can also remove parent tag with this one

Seems very responsive for all reasonable numbers of elements (can load up to a thousand nested tags in well under 100 ms). for larger numbers, pagination would be the way to go anyway.

- loosely based on the concept of stamp by J Gregorio https://github.com/jcgregorio/stamp