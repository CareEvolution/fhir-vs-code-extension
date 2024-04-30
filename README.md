# CareEvolutioin FHIR Tools

This extension provides tools for working with FHIR bundles.

## Features

This extension adds a FHIR Resources tree view to the primary sidebar that shows you all of the resources that appear in the FHIR bundle in the active window. If you click on a resource identifier in the tree, we scroll to and highlight that resource in the bundle.

![Tree View](./images/tree-view.png)


The tools include the following commands:

- **FHIR: Minify bundle**: Removes all the extraneous white space from a FHIR bundle to make it as small as possible. This is useful if you're sending your bundle to an API that has a size limit.
- **FHIR: Compare active file with...**: Lines up 2 bundles side-by-side and sorts the resources and their properties so that you can compare them and see what is similar and what is different between them. When comparing 2 bundles, The FHIR Resources tree view includes resources from both bundles, indicating which ones are in bundle A only, bundle B only, or in both A and B.

Use the command palette (View -> Command Palette... or Ctrl + Shift + P) to access these commands. 


## Requirements

To compare 2 FHIR bundles, have them both open in editor tabs. 

## Known Issues

None currently.

## Release Notes

### 1.0.0

Initial release

## Contact Us
For questions or more information visit [CareEvolution](https://careevolution.com "CareEvolution") or email <info@careevolution.com>

**Enjoy!**
