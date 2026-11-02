
const expressionEl = document.querySelector("#expression");
const resultEl = document.querySelector("#result");
const buttons = document.querySelector(".buttons");

let expression = "";
let justCalculated = false;

// Convert expression into valid mathematical tokens
function tokenize(input) {
    const tokens = input.match(/\d*\.?\d+|[+\-*/%]/g);

    if (!tokens || tokens.join("") !== input) {
        throw new Error("Invalid expression");
    }

    return tokens;
}

// Calculate using operator precedence
function evaluate(input) {
    const tokens = tokenize(input);
    let position = 0;

    function factor() {
        let sign = 1;

        while (
            tokens[position] === "+" ||
            tokens[position] === "-"
        ) {
            if (tokens[position] === "-") {
                sign *= -1;
            }
            position++;
        }

        const number = tokens[position++];

        if (!number || !/^\d*\.?\d+$/.test(number)) {
            throw new Error("Invalid number");
        }

        return sign * Number(number);
    }

    function term() {
        let value = factor();

        while (
            ["*", "/", "%"].includes(tokens[position])
        ) {
            const operator = tokens[position++];
            const next = factor();

            if (
                (operator === "/" || operator === "%") &&
                next === 0
            ) {
                throw new Error("Cannot divide by zero");
            }

            if (operator === "*") {
                value *= next;
            } else if (operator === "/") {
                value /= next;
            } else {
                value %= next;
            }
        }

        return value;
    }

    let answer = term();

    while (
        tokens[position] === "+" ||
        tokens[position] === "-"
    ) {
        const operator = tokens[position++];
        const next = term();

        answer = operator === "+"
            ? answer + next
            : answer - next;
    }

    if (
        position !== tokens.length ||
        !Number.isFinite(answer)
    ) {
        throw new Error("Invalid calculation");
    }

    return Number(answer.toPrecision(12));
}

// Format result for display
function format(number) {
    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 10
    }).format(number);
}

// Update display
function preview() {
    expressionEl.textContent = expression;

    try {
        resultEl.textContent = expression
            ? format(evaluate(expression))
            : "0";
    } catch {
        resultEl.textContent = "—";
    }
}

// Calculate final answer
function calculate() {
    if (!expression) return;

    try {
        const answer = evaluate(expression);

        expressionEl.textContent = expression + " =";
        resultEl.textContent = format(answer);

        expression = String(answer);
        justCalculated = true;

    } catch (error) {
        resultEl.textContent =
            error.message === "Cannot divide by zero"
                ? "Cannot divide by 0"
                : "Error";
    }
}

// Add number or operator
function add(value) {
    if (justCalculated && !"+-*/%".includes(value)) {
        expression = "";
    }

    justCalculated = false;

    if (
        "+-*/%".includes(value) &&
        !expression &&
        value !== "-"
    ) {
        return;
    }

    if (
        "+-*/%".includes(value) &&
        "+-*/%".includes(expression.at(-1))
    ) {
        expression = expression.slice(0, -1);
    }

    if (value === ".") {
        const current = expression.split(/[+\-*/%]/).at(-1);

        if (current.includes(".")) return;

        if (!current) {
            expression += "0";
        }
    }

    expression += value;
    preview();
}

// Button click handling
buttons.addEventListener("click", function(event) {
    const button = event.target.closest("button");

    if (!button) return;

    const action = button.dataset.action;
    const value = button.dataset.value;

    if (action === "clear") {
        expression = "";
        justCalculated = false;
        preview();
        return;
    }

    if (action === "delete") {
        expression = expression.slice(0, -1);
        justCalculated = false;
        preview();
        return;
    }

    if (action === "calculate") {
        calculate();
        return;
    }

    if (value !== undefined) {
        add(value);
    }
});

// Keyboard support
document.addEventListener("keydown", function(event) {
    if (/^[0-9.+\-*/%]$/.test(event.key)) {
        add(event.key);
    }

    else if (event.key === "Backspace") {
        expression = expression.slice(0, -1);
        justCalculated = false;
        preview();
    }

    else if (event.key === "Enter") {
        event.preventDefault();
        calculate();
    }

    else if (event.key === "Escape") {
        expression = "";
        justCalculated = false;
        preview();
    }
});

// Initial display
preview();
