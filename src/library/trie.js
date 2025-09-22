export class TrieNode {
  constructor() {
    this.children = {};
    this.isEndOfWord = false;
  }
}

export class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(words) {
    for (const word of words) {
      let node = this.root;
      for (const char of word) {
        if (!node.children[char]) {
          node.children[char] = new TrieNode();
        }
        node = node.children[char];
      }
      node.isEndOfWord = true;
    }
    this.words = new Set();
    words.forEach(this.words.add, this.words);
  }

  getWord(prefix) {
    let node = this.root;
    let result = "";

    // Step 1: walk down the prefix
    for (const char of prefix) {
      if (!node.children[char]) return ""; // prefix not found
      result += char;
      node = node.children[char];
    }

    // Step 2: auto-complete while only one child and not end of word
    while (Object.keys(node.children).length === 1 && !node.isEndOfWord) {
      const nextChar = Object.keys(node.children)[0];
      result += nextChar;
      node = node.children[nextChar];
    }

    return result;
  }
}
