
const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const buttons = document.querySelector(".buttons");

let expression = "";
let justCalculated = false;

function showDisplay() {
    expressionDisplay.textContent = expression || "Ready to calculate";
    resultDisplay.textContent = expression || "0";
}

function clearCalculator() {
    expression = "";
    justCalculated = false;
    showDisplay();
}

function deleteLast() {
    expression = expression.slice(0, -1);
    justCalculated = false;
    showDisplay();
}

function addValue(value) {
    if (justCalculated && /[0-9.]/.test(value)) {
        expression = "";
    }

    justCalculated = false;

    if (value === ".") {
        const currentNumber = expression.split(/[+\-*/]/).pop();
        if (currentNumber.includes(".")) return;

        if (!currentNumber) value = "0.";
    }

    if (/[+\-*/]/.test(value) &&
        /[+\-*/]$/.test(expression)) {
        expression = expression.slice(0, -1);
    }

    expression += value;
    showDisplay();
}

function calculate() {
    if (!expression) return;

    try {
        const result = evaluateExpression(expression);

        if (!Number.isFinite(result)) {
            throw new Error("Invalid calculation");
        }

        expressionDisplay.textContent = expression + " =";
        resultDisplay.textContent = Number(result.toFixed(10)).toString();

        expression = resultDisplay.textContent;
        justCalculated = true;

    } catch (error) {
        resultDisplay.textContent = "Error";
        expressionDisplay.textContent = "Invalid expression";
        expression = "";
        justCalculated = false;
    }
}

// Safe expression evaluator with operator precedence
function evaluateExpression(input) {
    const tokens = input.match(
        /(?:\d+(?:\.\d*)?|\.\d+)|[+\-*/]/g
    );

    if (!tokens || tokens.join("") !== input) {
        throw new Error("Invalid input");
    }

    const output = [];
    const operators = [];
    const precedence = {
        "+": 1,
        "-": 1,
        "*": 2,
        "/": 2,
        "u-": 3
    };

    let previous = "operator";

    for (let token of tokens) {
        if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
            if (previous === "number") {
                throw new Error("Invalid expression");
            }
            output.push(Number(token));
            previous = "number";
        } else {
            if (token === "-" && previous === "operator") {
                token = "u-";
            } else if (previous !== "number") {
                throw new Error("Invalid expression");
            }

            while (
                operators.length &&
                precedence[operators.at(-1)] > precedence[token]
            ) {
                output.push(operators.pop());
            }

            operators.push(token);
            previous = "operator";
        }
    }

    if (previous !== "number") {
        throw new Error("Incomplete expression");
    }

    while (operators.length) {
        output.push(operators.pop());
    }

    const stack = [];

    for (const token of output) {
        if (typeof token === "number") {
            stack.push(token);
        } else if (token === "u-") {
            if (stack.length < 1) throw new Error("Invalid expression");
            stack.push(-stack.pop());
        } else {
            if (stack.length < 2) throw new Error("Invalid expression");

            const b = stack.pop();
            const a = stack.pop();

            switch (token) {
                case "+":
                    stack.push(a + b);
                    break;
                case "-":
                    stack.push(a - b);
                    break;
                case "*":
                    stack.push(a * b);
                    break;
                case "/":
                    if (b === 0) throw new Error("Division by zero");
                    stack.push(a / b);
                    break;
            }
        }
    }

    if (stack.length !== 1) throw new Error("Invalid expression");

    return stack[0];
}

// Event delegation: handle all calculator buttons
buttons.addEventListener("click", function(event) {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const value = button.dataset.value;

    if (action === "clear") {
        clearCalculator();
    } else if (action === "delete") {
        deleteLast();
    } else if (action === "calculate") {
        calculate();
    } else if (value !== undefined) {
        addValue(value);
    }
});

// Keyboard support
document.addEventListener("keydown", function(event) {
    if (/^[0-9.]$/.test(event.key)) {
        addValue(event.key);
    } else if (["+", "-", "*", "/"].includes(event.key)) {
        addValue(event.key);
    } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        calculate();
    } else if (event.key === "Backspace") {
        deleteLast();
    } else if (event.key === "Escape") {
        clearCalculator();
    }
});

showDisplay();
