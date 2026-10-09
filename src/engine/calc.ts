// A small calculator for the Calculator tool. It parses the expression itself
// (recursive descent) so nothing a user or an AI types is ever executed as code.

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  log: Math.log10,
  ln: Math.log,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export function calculate(expression: string): number {
  const src = expression.replace(/\s+/g, "").toLowerCase();
  if (!src) throw new Error("Nothing to calculate.");
  if (src.length > 200) throw new Error("That expression is too long.");
  let pos = 0;
  const peek = () => src[pos];
  const eat = (ch: string) => {
    if (src[pos] === ch) {
      pos++;
      return true;
    }
    return false;
  };

  // expr := term (('+'|'-') term)*
  function expr(): number {
    let value = term();
    for (;;) {
      if (eat("+")) value += term();
      else if (eat("-")) value -= term();
      else return value;
    }
  }
  // term := power (('*'|'/'|'%') power)*
  function term(): number {
    let value = power();
    for (;;) {
      if (eat("*")) value *= power();
      else if (eat("/")) {
        const d = power();
        if (d === 0) throw new Error("Cannot divide by zero.");
        value /= d;
      } else if (eat("%")) value %= power();
      else return value;
    }
  }
  // power := unary ('^' power)?   (right-associative)
  function power(): number {
    const base = unary();
    return eat("^") ? Math.pow(base, power()) : base;
  }
  function unary(): number {
    if (eat("-")) return -unary();
    if (eat("+")) return unary();
    return atom();
  }
  function atom(): number {
    if (eat("(")) {
      const value = expr();
      if (!eat(")")) throw new Error("A bracket is missing.");
      return value;
    }
    const num = /^\d*\.?\d+(?:e[+-]?\d+)?/.exec(src.slice(pos));
    if (num) {
      pos += num[0].length;
      return parseFloat(num[0]);
    }
    const word = /^[a-z]+/.exec(src.slice(pos));
    if (word) {
      pos += word[0].length;
      const name = word[0];
      if (name in CONSTANTS) return CONSTANTS[name] as number;
      const fn = FUNCTIONS[name];
      if (fn && peek() === "(") return fn(atom());
      throw new Error(`Unknown word "${name}".`);
    }
    throw new Error(`Unexpected "${peek() ?? "end"}".`);
  }

  const value = expr();
  if (pos < src.length) throw new Error(`Unexpected "${src[pos]}".`);
  if (!Number.isFinite(value)) throw new Error("The result is not a finite number.");
  return value;
}

/** Pulls a calculable expression out of everyday wording, e.g. "what is 12 times 7?" → "12*7". */
export function extractExpression(question: string): string {
  const text = question
    .toLowerCase()
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/\btimes\b|\bmultiplied by\b|×/g, "*")
    .replace(/\bdivided by\b|÷/g, "/")
    .replace(/\bplus\b/g, "+")
    .replace(/\bminus\b/g, "-")
    .replace(/\bsquared\b/g, "^2")
    .replace(/\bsquare root of\b/g, "sqrt")
    .replace(/(\d+(?:\.\d+)?)\s*% of\s*(\d+(?:\.\d+)?)/g, "($1/100*$2)")
    .replace(/\bof\b/g, "*");
  const runs = text.match(/(?:sqrt|[\d.+\-*/^%() ])+/g) ?? [];
  const best = runs
    .map((r) => r.trim())
    .filter((r) => /\d/.test(r))
    .sort((a, b) => b.length - a.length)[0];
  return (best ?? "").replace(/sqrt\s*(\d+(?:\.\d+)?)/g, "sqrt($1)");
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
}
