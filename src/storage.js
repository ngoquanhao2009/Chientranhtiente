export function saveToLocalStorage(data) {
    localStorage.setItem('gameData', JSON.stringify(data));
}

export function loadFromLocalStorage() {
    return JSON.parse(localStorage.getItem('gameData')) || {};
}