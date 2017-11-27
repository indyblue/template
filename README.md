# template
loosely based on the concept of stamp by J Gregorio https://github.com/jcgregorio/stamp

looks at an existing element (or template tag). 
* It will make a cloned copy of the element
* iterate through all attributes and childNodes looking for mustache patterns or data-repeat elements
* it pre-stores all these paths and patterns into arrays. In theory this should save time for complex structures by only fully iterating the DOM of the element once.
* when the template is `exec`ed against a data set, it will create a new element clone and will replace all the expressions with the data evaluation of them. 
* (elements it can't find it replaces with an empty string...probably need to either add a console message or change this behavior)

benchmarking against jgregorio's project
- included his library in the repo
- so far in head-to-head comparisons, new method is a tiny bit faster...but that may just be because the DOM of the template is pretty simple. need to flesh it out a lot and see what happens. 
- I would foresee the main advangates of pre-caching mustache locations would be seen 
  - when the structure is larger/more complex
  - especially with a relatively high number of static elements/attrs to "mustache" elements.
  - this should save time both in iterating the DOM and also in performing a lot of repetitive ops each time

TODO list:
- ability to pull in another template...maybe this is best handled the way jgregorio proposes with custom elements?
- binding: 
  - doing this with event binding...easiest way I think? ~~changeable html elements (input, select, textarea) bind back to js object-d  d~~
  - maybe bind from js object to DOM...maybe using a helper function like React does?
- mustache areas:
  - handle functions in data object?
    - argless only? this would be pretty easy, just a typeof check
    - scalar args only? more complex, but mininally so
    - full args? pretty hairy probably
  - operators? complex expressions?
  - or just push these off into properties and functions?
  - (leaning toward argless functions as cleanest option, especially for keeping the parsing clean and fast)
