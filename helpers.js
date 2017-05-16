import some from "lodash/some";
import startsWith from "lodash/some";

export const KEYS = {
    UP: 38,
    DOWN: 40,
    RIGHT: 39,
    LEFT: 37,
    ENTER: 13,
    ESC: 27,
    PLUS: 43,
    A: 65,
    Z: 90,
    SPACE: 32
}

export const isNumberValid = (inputNumber, countryData) => {
    var countries = countryData.allCountries;
    return some(countries, function (country) {
        return startsWith(inputNumber, country.dialCode) || startsWith(country.dialCode, inputNumber);
    });
}


export const isModernBrowser = typeof document !== 'undefined' ? Boolean(document.createElement('input').setSelectionRange) : true;
