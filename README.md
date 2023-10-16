# EcoSurf Analyser

Description: Mozilla Extension to display on the navbar the ecoIndex score of the page.

The extension call the ecoIndex Api to get the score displayed on the nav bar. 

More information about the EcoIndex API [here](https://github.com/cnumr/ecoindex_api)

## Installation 

### Firefox add-on catalog

The extension is available [here](https://addons.mozilla.org/firefox/addon/ecosurf-analyser/)

### Install locally

- download the repository
- open your browser and go to `about:debugging#/runtime/this-firefox`
- click on button : `load temporary extension firefox`
- select the manifest.json located in the EcoSurfAnalyser folder

## How it works

On each website the user goes. The extension get the url and ask ecoIndex API is an analysis has been made recently.
- If so the extention return the score from `A` to `G` visible on the navbar. `A` meaning a small carbon foodprint impact and `G` a significant carbon foodprint.
- If no data were collected, the extension ask EcoIndex API to measure the website. Following an heuristic strategy, EcoSurf Analyser will try again to contact the server to fetch data based on the original url. 

## Dependencies

As mention above, [the EcoIndex API](https://github.com/cnumr/ecoindex_api)

## Contribute

If you found a bug, please open a [issue](https://github.com/les-enovateurs/estimate-good-website/issues) (please search first if the bug is already mention on an existing issue).
Feel free to contribute by creation a [pull request](https://github.com/les-enovateurs/estimate-good-website/pulls)
