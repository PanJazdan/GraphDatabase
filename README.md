# Neo4j Investigation

Prosta aplikacja demonstracyjna do wizualizacji i modyfikacji bazy grafowej Neo4j.
Pozwala na przeglądanie węzłów, tworzenie i usuwanie relacji oraz wykonywanie własnych zapytań Cypher.

---

## Funkcjonalności

- Przeglądanie węzłów według typów: Suspect, Witness, Victim, Evidence, CrimeScene
- Dodawanie nowych węzłów z unikalnym ID
- Tworzenie relacji między węzłami zgodnie z ustalonymi regułami:
- `KILLED_AT` : Victim → CrimeScene
- `WITNESSED` : Witness → Suspect
- `WAS_AT` : Witness → CrimeScene
- `FOUND_AT` : Evidence → CrimeScene
- `EVIDENCE_OF` : Evidence → Suspect
- Edycja nazwy węzła po ID
- Usuwanie węzłów i relacji
- Interaktywna wizualizacja grafu z legendą
- Wykonywanie własnych zapytań Cypher

## Uruchamianie aplikacji
### Windows - Winget
- Otwórz konsolę PowerShell
- Sprawdź czy masz zainstalowany *winget*
`winget --version`
- Znajdź pakiet Node.js
`winget search nodejs`
Zainstaluj Node.js
`winget install OpenJS.NodeJS.LTS`
- Odśwież konsolę/Zamknij i otwórz nową
- Sprawdź czy masz zainstalowany Node i npm
`node -v`
`npm -v`

- W przypadku komunikatu: *cannot be loaded because running scripts is disabled on this system* sprawdź politykę wykonania 
`Get-ExecutionPolicy`
i tymczasowo pozwól na uruchomienie skryptu
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- Ponownie sprawdź 
`node -v`
`npm -v`

- Przejdź do katalogu, w którym rozpakowany został projekt
- Utwórz plik `.env` na podstawie `.env.example` i uzupełnij wymagane dane.
- Uruchom:
`npm install`
- Możliwe będzie uruchomienie projektu:
`npm start`
- Wejdź na przeglądarce na 
`http:localhost:3000`
lub inny port, który został skonfigurowany w pliku `.env`

### Linux
`cd <nazwa-projektu>`

Zainstaluj zależności:
`npm install`

Utwórz plik `.env` na podstawie `.env.example` i uzupełnij wymagane dane.

Uruchom aplikację:
`npm start`

Serwer uruchomi się na porcie zadeklarowanym w pliku `.env` (domyślnie 3000).
Po uruchomieniu aplikacji otwórz w przeglądarce adres:

`http:localhost:3000`

## Struktura projektu

```
node_modules
public
├- index.html
└- script.js
.env
package.json
package-lock.json
server.js
```

- `server.js` – serwer Express z endpointem apiquery do wykonywania zapytań Cypher
- `publicindex.html` – interfejs użytkownika
- `publicscript.js` – logika frontendu (wizualizacja grafu, przyciski, API)
- `.env` – konfiguracja połączenia z Neo4j