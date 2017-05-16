import {KEYS, isNumberValid, isModernBrowser} from './helpers';
import {allCountries, iso2Lookup, allCountryCodes} from './countryData';
import startsWith from 'lodash/startsWith';
import findIndex from 'lodash/findIndex';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import reduce from 'lodash/reduce';
import first from 'lodash/first';
import trim from 'lodash/trim';
import find from 'lodash/find';
import tail from 'lodash/tail';
import map from 'lodash/map';

class PhoneInput extends React.Component {
    static defaultProps = {
        autoFormat: true,
        onlyCountries: allCountries,
        defaultCountry: allCountries[0].iso2,
        isValid: isNumberValid,
        flagsImagePath: 'flags.png',
        onEnterKeyPress: function onEnterKeyPress() {},
        preferredCountries: [],
        disabled: false,
        placeholder: '+1 (702) 123-4567'
    }

    constructor(props) {
        super(props);
        let preferredCountries = props.preferredCountries.map(iso2 => {
            if (props.onlyCountries.length) {
                return iso2Lookup[iso2] ? props.onlyCountries[iso2Lookup[iso2]] : null;
            } else {
                return iso2Lookup[iso2] ? allCountries[iso2Lookup[iso2]] : null;
            }
        }).filter(val => {
            return val !== null;
        })

        this.state = {
            preferredCountries: preferredCountries,
            showDropDown: false,
            queryString: '',
            freezeSelection: false,
            debouncedQueryStingSearcher: debounce(this.searchCountry, 300),
            ...this.mapPropsToState(props, true)
        }
    }

    mapPropsToState(props, firstCall) {
        let currentSelectedCountry = this.state ? this.state.selectedCountry : {}
        let inputNumber = undefined;

        if (props.value || props.value === '') {
            inputNumber = props.value;
        } else if (props.initialValue && firstCall) {
            inputNumber = props.initialValue;
        } else if (this.state && this.state.formattedNumber && this.state.formattedNumber.length > 0) {
            inputNumber = this.state.formattedNumber;
        } else {
            inputNumber = '';
        }

        let selectedCountryGuess = this.guessSelectedCountry(inputNumber.replace(/\D/g, ''));
        // lets check, if current selected country is the same as guessed country.
        // we need to check, if the iso is changing as well
        let countryToUse;
        if (selectedCountryGuess.iso2 !== currentSelectedCountry.iso2 && selectedCountryGuess.dialCode !== currentSelectedCountry.dialCode && inputNumber) {
            countryToUse = selectedCountryGuess;
        } else {
            countryToUse = currentSelectedCountry;
        }

        if (!countryToUse.iso2) {
            countryToUse = selectedCountryGuess;
        }
        let selectedCountryGuessIndex = findIndex(allCountries, countryToUse);
        let formattedNumber = this.formatNumber(inputNumber.replace(/\D/g, ''), countryToUse ? selectedCountryGuess.format : null);

        return {
            selectedCountry: countryToUse,
            highlightCountryIndex: selectedCountryGuessIndex,
            formattedNumber: formattedNumber === "+" ? "" : formattedNumber
        };
    }

    componentDidMount() {
        document.addEventListener('keydown', this.handleKeydown);
    }

    shouldComponentUpdate(nextProps, nextState) {
        return !isEqual(nextProps, this.props) || !isEqual(nextState, this.state);
    }

    componentWillReceiveProps(nextProps) {
        this.setState(this.mapPropsToState(nextProps));
    }

    componentWillUpdate(nextProps, nextState) {
        document.removeEventListener('keydown', this.handleKeydown);
    }

    getNumber() {
        return this.state.formattedNumber !== '+' ? this.state.formattedNumber : '';
    }

    getElement(index) {
        return ReactDOM.findDOMNode(this.refs['flag_no_' + index]);
    }

    getValue() {
        return this.getNumber();
    }

    scrollTo(country, middle) {
        if (!country) {
            return;
        }

        let container = ReactDOM.findDOMNode(this.refs.flagDropdownList);

        if (!container) {
            return;
        }

        let containerHeight = container.offsetHeight;
        let containerOffset = container.getBoundingClientRect();
        let containerTop = containerOffset.top + document.body.scrollTop;
        let containerBottom = containerTop + containerHeight;

        let element = country;
        let elementOffset = element.getBoundingClientRect();

        let elementHeight = element.offsetHeight;
        let elementTop = elementOffset.top + document.body.scrollTop;
        let elementBottom = elementTop + elementHeight;
        let newScrollTop = elementTop - containerTop + container.scrollTop;
        let middleOffset = containerHeight / 2 - elementHeight / 2;

        if (elementTop < containerTop) {
            // scroll up
            if (middle) {
                newScrollTop -= middleOffset;
            }
            container.scrollTop = newScrollTop;
        } else if (elementBottom > containerBottom) {
            // scroll down
            if (middle) {
                newScrollTop += middleOffset;
            }
            let heightDifference = containerHeight - elementHeight;
            container.scrollTop = newScrollTop - heightDifference;
        }
    }

    searchCountry() {
        const handleSearchCountry = (queryString) => {
            if (!queryString || queryString.length === 0) {
                return null;
            }
            // don't include the preferred countries in search
            let probableCountries = filter(this.props.onlyCountries, function (country) {
                return startsWith(country.name.toLowerCase(), queryString.toLowerCase());
            }, this);
            return probableCountries[0];
        }

        let probableCandidate = handleSearchCountry(this.state.queryString) || this.props.onlyCountries[0];
        let probableCandidateIndex = findIndex(this.props.onlyCountries, probableCandidate) + this.state.preferredCountries.length;
        // console.log('probableCandidateIndex', probableCandidateIndex);
        this.scrollTo(this.getElement(probableCandidateIndex), true);
        this.setState({
            queryString: '',
            highlightCountryIndex: probableCandidateIndex
        });
    }

    formatNumber(text, pattern) {
        if (!text || text.length === 0) {
            return '+';
        }

        // for all strings with length less than 3, just return it (1, 2 etc.)
        // also return the same text if the selected country has no fixed format
        if (text && text.length < 2 || !pattern || !this.props.autoFormat) {
            return '+' + text;
        }

        let formattedObject = reduce(pattern, (acc, character) => {
            if (acc.remainingText.length === 0) {
                return acc;
            }

            if (character !== '.') {
                return {
                    formattedText: acc.formattedText + character,
                    remainingText: acc.remainingText
                };
            }

            return {
                formattedText: acc.formattedText + first(acc.remainingText),
                remainingText: tail(acc.remainingText)
            };
        }, { formattedText: '', remainingText: text.split('') });

        return formattedObject.formattedText + formattedObject.remainingText.join('');
    }

    cursorToEnd(skipFocus) {
        const input = this.refs.numberInput;
        if (skipFocus) {
            this.fillDialCode();
        } else {
            input.focus();
            if (isModernBrowser) {
                let len = input.value.length;
                input.setSelectionRange(len, len);
            }
        }
    }

    guessSelectedCountry(inputNumber) {
        let secondBestGuess = find(this.props.onlyCountries, { iso2: this.props.defaultCountry }) || this.props.onlyCountries[0];
        let inputNumberForCountries = inputNumber.substr(0, 4);
        let bestGuess = {};
        if (trim(inputNumber) !== '') {
            bestGuess = reduce(this.props.onlyCountries, (selectedCountry, country) => {
                let countryFromAllCountries;
                let indexOfSelectedCountry;
                let selectedCountryInCountries

                // if the country dialCode exists WITH area code
                if (allCountryCodes[inputNumberForCountries]) {
                    countryFromAllCountries =  allCountryCodes[inputNumberForCountries][0];
                    indexOfSelectedCountry = allCountryCodes[inputNumberForCountries].indexOf(secondBestGuess.iso2)
                    selectedCountryInCountries = allCountryCodes[inputNumberForCountries][indexOfSelectedCountry]

                    if (indexOfSelectedCountry >= 0 && countryFromAllCountries === country.iso2) {
                        return selectedCountry;
                    } else if (countryFromAllCountries === country.iso2) {
                        return country;
                    }

                    // else do the original if statement

                } else {
                    if (startsWith(inputNumber, country.dialCode)) {
                        if (country.dialCode.length > selectedCountry.dialCode.length) {
                            return country;
                        }
                        if (country.dialCode.length === selectedCountry.dialCode.length && country.priority < selectedCountry.priority) {
                            return country;
                        }
                    }
                }
                return selectedCountry;
            }, { dialCode: '', priority: 10001 }, this);
        } else {
            return secondBestGuess;
        }

        if (!bestGuess.name) {
            return secondBestGuess;
        }
        return bestGuess;
    }

    handleFlagDropdownClick() {
        if (this.props.disabled) {
            return;
        }
        // need to put the highlight on the current selected country if the dropdown is going to open up
        this.setState({
            showDropDown: !this.state.showDropDown,
            highlightCountry: find(this.props.onlyCountries, this.state.selectedCountry),
            highlightCountryIndex: findIndex(this.state.preferredCountries.concat(this.props.onlyCountries), this.state.selectedCountry)
        }, () => {
            // only need to scrool if the dropdown list is alive
            if (this.state.showDropDown) {
                this.scrollTo(this.getElement(this.state.highlightCountryIndex + this.state.preferredCountries.length));
            }
        });
    }

    handleInput(e) {
        let formattedNumber = '+',
        newSelectedCountry = this.state.selectedCountry,
        freezeSelection = this.state.freezeSelection;

        // if the input is the same as before, must be some special key like enter etc.
        if (e.target.value === this.state.formattedNumber) {
            return;
        }

        // ie hack
        if (e.preventDefault) {
            e.preventDefault();
        } else {
            e.returnValue = false;
        }

        if (e.target.value.length > 0) {
            // before entering the number in new format, lets check if the dial code now matches some other country
            let inputNumber = e.target.value.replace(/\D/g, '');

            // we don't need to send the whole number to guess the country... only the first 6 characters are enough
            // the guess country function can then use memoization much more effectively since the set of input it gets has drastically reduced
            if (!this.state.freezeSelection || this.state.selectedCountry.dialCode.length > inputNumber.length) {
                newSelectedCountry = this.guessSelectedCountry(inputNumber.substring(0, 6));
                freezeSelection = false;
            }
            // let us remove all non numerals from the input
            formattedNumber = this.formatNumber(inputNumber, newSelectedCountry.format);
        }

        let caretPosition = e.target.selectionStart;
        let oldFormattedText = this.state.formattedNumber;
        let diff = formattedNumber.length - oldFormattedText.length;

        this.setState({
            formattedNumber: formattedNumber,
            freezeSelection: freezeSelection,
            selectedCountry: newSelectedCountry.dialCode.length > 0 ? newSelectedCountry : this.state.selectedCountry
        }, () => {
            if (isModernBrowser) {
                if (caretPosition === 1 && formattedNumber.length === 2) {
                    caretPosition++;
                }

                if (diff > 0) {
                    caretPosition = caretPosition - diff;
                }

                if (caretPosition > 0 && oldFormattedText.length >= formattedNumber.length) {
                    this.refs.numberInput.setSelectionRange(caretPosition, caretPosition);
                }
            }

            if (this.props.onChange) {
                this.props.onChange(this.state.formattedNumber, this.state.selectedCountry);
            }
        });
    }

    handleInputClick() {
        this.setState({ showDropDown: false });
    }

    handleFlagItemClick(country) {
        let currentSelectedCountry = this.state.selectedCountry;
        let nextSelectedCountry = find(this.props.onlyCountries, country);

        // tiny optimization
        if (currentSelectedCountry.iso2 !== nextSelectedCountry.iso2) {
            let dialCodeRegex = RegExp('^(\\+' + currentSelectedCountry.dialCode + ')|\\+');
            let newNumber = this.state.formattedNumber.replace(dialCodeRegex, '+' + nextSelectedCountry.dialCode);
            let formattedNumber = this.formatNumber(newNumber.replace(/\D/g, ''), nextSelectedCountry.format);
            formattedNumber = formattedNumber !== "+" ? formattedNumber : formattedNumber + nextSelectedCountry.dialCode
            this.setState({
                showDropDown: false,
                selectedCountry: nextSelectedCountry,
                freezeSelection: true,
                formattedNumber: formattedNumber
            }, () => {
                this.cursorToEnd();
                if (this.props.onChange) {
                    this.props.onChange(formattedNumber, nextSelectedCountry);
                }
            });
        } else {
            this.setState({ showDropDown: false });
        }
    }

    handleInputFocus() {
        // trigger parent component's onFocus handler
        if (typeof this.props.onFocus === 'function') {
            let number = this.state.formattedNumber;
            if (!this.state.formattedNumber) {
                number = "+" + this.state.selectedCountry.dialCode;

            }
            this.props.onFocus(number, this.state.selectedCountry);
        }

        this.fillDialCode();

    }

    fillDialCode() {
        // if the input is blank, insert dial code of the selected country
        if (!this.refs.numberInput.value || this.refs.numberInput.value === '+' ) {
            this.setState({ formattedNumber: '+' + this.state.selectedCountry.dialCode });
        }
    }

    getHighlightCountryIndex(direction) {
        // had to write own function because underscore does not have findIndex. lodash has it
        let highlightCountryIndex = this.state.highlightCountryIndex + direction;

        if (highlightCountryIndex < 0 || highlightCountryIndex >= this.props.onlyCountries.length + this.state.preferredCountries.length) {
            return highlightCountryIndex - direction;
        }

        return highlightCountryIndex;
    }

    handleKeydown(event) {
        if (!this.state.showDropDown) {
            return;
        }

        // ie hack
        if (event.preventDefault) {
            event.preventDefault();
        } else {
            event.returnValue = false;
        }

        var self = this;
        const moveHighlight = (direction) => {
            this.setState({
                highlightCountryIndex: this._getHighlightCountryIndex(direction)
            }, () => {
                this.scrollTo(this.getElement(self.state.highlightCountryIndex), true);
            });
        }

        switch (event.which) {
            case KEYS.DOWN:
            moveHighlight(1);
            break;
            case KEYS.UP:
            moveHighlight(-1);
            break;
            case KEYS.ENTER:
            console.log('enter key', this.state.highlightCountryIndex, this.props.onlyCountries[this.state.highlightCountryIndex]);
            this.handleFlagItemClick(this.state.preferredCountries.concat(this.props.onlyCountries)[this.state.highlightCountryIndex], event);
            break;
            case KEYS.ESC:
            this.setState({ showDropDown: false }, this._cursorToEnd);
            break;
            default:
            if (event.which >= KEYS.A && event.which <= KEYS.Z || event.which === KEYS.SPACE) {
                this.setState({ queryString: this.state.queryString + String.fromCharCode(event.which) }, this.state.debouncedQueryStingSearcher);
            }
        }
    }

    handleInputKeyDown(event) {
        if (event.which === KEYS.ENTER) {
            this.props.onEnterKeyPress(event);
        }
    }

    handleClickOutside() {
        if (this.state.showDropDown) {
            this.setState({
                showDropDown: false
            });
        }
    }

    handleInputBlur() {
        let state = {...this.state};
        if (typeof this.props.onBlur === 'function') {
            let number = this.state.formattedNumber;
            if (number === "+" + this.state.selectedCountry.dialCode) {
                number = "";
                state.formattedNumber = "";
                this.setState(state)
            }
            this.props.onBlur(number, this.state.selectedCountry);
        }
    }

    getCountryDropDownList() {
        const createDropDown = (arr) => {
            const list = arr.map((country, index) => {

                let itemClasses = this.state.highlightCountryIndex === index ? 'country highlight' : 'country';

                let inputFlagClasses = 'flag ' + country.iso2;

                return (
                    <li
                        ref={`flag_no_${index}`}
                        key={`flag_no_${index}`}
                        data-flag-key={`flag_no_${index}`}
                        className={itemClasses}
                        data-dial-code='1'
                        data-country-code={country.iso2}
                        onClick={this.handleFlagItemClick.bind(this, country)} >
                        <div className={inputFlagClasses} style={this.getFlagStyle()}>
                        </div>
                        <span className="country-name">{country.name}</span>
                        <span className="dial-code">+ {country.dialCode}</span>
                    </li>
                )
            })
            return list;
        }

        const prefferedCountryList = createDropDown(this.state.preferredCountries)
        const countryDropDownList = createDropDown(this.props.onlyCountries)
        const dashedLi = () => <li key="dashes" className="divider"></li>;

        const dropDownClasses = this.state.showDropDown ? 'country-list' : 'country-list hide';

        return (
            <ul ref="flagDropdownList" className={dropDownClasses}>
                {prefferedCountryList}
                {dashedLi}
                {countryDropDownList}
            </ul>
        )
    }

    getFlagStyle() {
        return {
            width: 16,
            height: 11,
            backgroundImage: 'url(' + this.props.flagsImagePath + ')'
        };
    }

    render() {
        const classNames = {
            arrowClasses: this.state.showDropDown ? 'arrow up' : 'arrow',
            inputClasses: 'form-control',
            flagViewClasses: this.state.showDropDown ? 'open-dropdown flag-dropdown' : 'flag-dropdown',
            inputFlagClasses: 'flag ' + this.state.selectedCountry.iso2
        }

        return (
            <div className="react-tel-input">
                <input
                    onChange={this.handleInput.bind(this)}
                    onClick={this.handleInputClick.bind(this)}
                    onFocus={this.handleInputFocus.bind(this)}
                    onBlur={this.handleInputBlur.bind(this)}
                    onKeyDown={this.handleInputKeyDown.bind(this)}
                    value={this.state.formattedNumber}
                    ref="numberInput"
                    type="tel"
                    className={classNames.inputClasses}
                    autoComplete="tel"
                    pattern={this.props.pattern}
                    placeholder={this.props.placeholder || ""}
                    disabled={this.props.disabled}
                    />
                <div ref="flagDropDownButton" className={classNames.flagViewClasses} onKeyDown={this.handleKeydown.bind(this)}>
                    <div ref="selectedFlag" onClick={this.handleFlagDropdownClick.bind(this)} className="selected-flag" title={this.state.selectedCountry.name + ": + " + this.state.selectedCountry.dialCode}>
                        <div className={classNames.inputFlagClasses} style={this.getFlagStyle()}>
                            <div className={classNames.arrowClasses}></div>
                        </div>
                    </div>
                    {this.state.showDropDown ? this.getCountryDropDownList() : ""}
                </div>
            </div>
        )
    }


}


export default PhoneInput;
