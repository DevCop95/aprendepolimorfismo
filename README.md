# 🛡️ RPG OOP Arena - Simulador de Polimorfismo en JavaScript

[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-E65100?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Glossary/HTML5)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/es/docs/Web/CSS)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Deploy-222222?style=for-the-badge&logo=github&logoColor=white)](https://devcop95.github.io/aprendepolimorfismo/)
[![API Source](https://img.shields.io/badge/API-DevCop95%2FrpgdevAPI-orange?style=for-the-badge&logo=gitbook&logoColor=white)](https://github.com/DevCop95/rpgdevAPI)

---

### 🎮 **[¡Prueba la Demo en Vivo Aquí!](https://devcop95.github.io/aprendepolimorfismo/)**

**RPG OOP Arena** es una aplicación interactiva diseñada con fines didácticos para explorar y comprender los principios fundamentales de la **Programación Orientada a Objetos (OOP)** y el **Polimorfismo** en JavaScript moderno, a través de un simulador de batallas de rol (RPG).

---

## 📖 Contenido
- [Características Principales](#-características-principales)
- [Origen de los Datos (API)](#-origen-de-los-datos-api)
- [Polimorfismo en Acción (Código)](#-polimorfismo-en-acción-código)
  - [1. Estructura del Factory](#1-estructura-del-factory)
  - [2. Sobrescritura de Daño (takeDamage)](#2-sobrescritura-de-daño-takedamage)
  - [3. Acciones de Habilidad (executeAction)](#3-acciones-de-habilidad-executeaction)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Uso Local](#-instalación-y-uso-local)
- [Despliegue y Enlaces](#-despliegue-y-enlaces)

---

## ✨ Características Principales

1. **Consumo Dinámico de API**: Descarga las estadísticas, habilidades, lore e imágenes de los personajes en tiempo real.
2. **Motor de Combate Polimórfico**: Un único bucle y llamada de acción maneja comportamientos totalmente distintos para cada clase (bloqueos, furia, evasiones, curaciones y reflejo de daño).
3. **Inspector de Código Integrado**: Permite ver el código fuente de JavaScript de cada clase directamente en la pantalla de la aplicación al seleccionarla.
4. **Pergamino del Hechicero (Feedback en Vivo)**: Muestra explicaciones dinámicas paso a paso sobre qué comportamiento del polimorfismo se ejecutó en cada turno.
5. **Estética Medieval Premium**: Diseño responsivo y estilizado utilizando **Glassmorphism**, auras de turno activas, círculos de invocación animados y consola de registros coloreada por tipo de evento.

---

## 🌐 Origen de los Datos (API)

Esta aplicación consume dinámicamente los datos de personajes del repositorio público de:
* 📁 **[DevCop95/rpgdevAPI](https://github.com/DevCop95/rpgdevAPI)**

Al iniciar la página, se lee el índice general y se realiza un `fetch()` a cada endpoint JSON correspondiente (ej. `guerrero.json`, `ninja.json`, etc.) para instanciar a los personajes con sus estadísticas y poses en la arena de combate.

---

## 🧬 Polimorfismo en Acción (Código)

El polimorfismo permite que objetos de diferentes clases respondan a la misma llamada de método con comportamientos específicos de su clase.

En el motor del simulador, cada vez que un personaje realiza una acción o recibe daño, el bucle principal de la arena ejecuta exactamente la misma línea de código:

```javascript
// El motor de juego no sabe qué tipo de personaje es, solo invoca la acción común
const result = personajeActivo.executeAction(abilityIndex, objetivo);
```

### 1. Estructura del Factory
Para crear la instancia correcta según el ID devuelto por la API, se implementa el patrón de **Factory**:
```javascript
class CharacterFactory {
    static create(data) {
        const id = data.id.toLowerCase();
        switch(id) {
            case "guerrero": return new Warrior(data);
            case "berserker": return new Berserker(data);
            case "mago": return new Mage(data);
            case "clerigo": return new Cleric(data);
            case "curandera": return new Healer(data);
            case "ninja": return new Ninja(data);
            case "templario": return new Templar(data);
            default: return new Character(data); // Fallback a clase base común
        }
    }
}
```

### 2. Sobrescritura de Daño (`takeDamage`)
La clase base `Character` mitiga daño físicamente por defensa básica. Sin embargo, las subclases sobrescriben este método para cambiar el cálculo:
* **Guerrero (`Warrior`)**: Bloquea un 60% de daño físico entrante si alzó su escudo, y un 25% de forma pasiva.
* **Ninja (`Ninja`)**: Tiene una probabilidad aleatoria de esquivar por completo el ataque físico en base a su velocidad:
  ```javascript
  takeDamage(amount, type = "physical", attacker = null) {
      if (type === "physical") {
          let evasionChance = (this.stats.speed) / 250;
          if (Math.random() < evasionChance) {
              return { damage: 0, effects: ["¡Esquivado! (Ninja Dodge)"] };
          }
      }
      return super.takeDamage(amount, type, attacker); // Mitigación base si no esquiva
  }
  ```
* **Templario (`Templar`)**: Absorbe daño con su barrera sagrada y refleja un 20% del daño final de vuelta al atacante.

### 3. Acciones de Habilidad (`executeAction`)
El método `executeAction` decide qué efecto tiene la habilidad del personaje:
* **Mago (`Mage`)**: Valida y descuenta maná, lanzando daño mágico que ignora armadura física y se reduce por resistencia mágica.
* **Clérigo y Curandera**: En lugar de atacar al enemigo, redirigen la acción hacia aliados (`teamAllies`) para curar vida o colocar escudos mágicos.
* **Berserker (`Berserker`)**: Sacrifica su propia vida para infligir daño incrementado en base a su furia acumulada (más daño cuanto menos vida le quede).

---

## 📁 Estructura del Proyecto

* 📄 `index.html`: Estructura semántica de la interfaz, paneles responsivos y modales de información.
* 🎨 `index.css`: Hoja de estilos medieval, animaciones de daño/cura, auras activas y glassmorphic HUD.
* ⚡ `index.js`: Jerarquía de clases (OOP), fábrica de personajes, lógica del simulador por turnos, formateador de consola e inspector de código.
* 🛡️ `favicon.svg`: Icono vectorial de dado D20 para el sitio.

---

## 🚀 Instalación y Uso Local

No requiere compilación de Node.js ni bundlers complejos ya que está escrito en Vanilla JS/CSS puro.

1. Clona el repositorio:
   ```bash
   git clone https://github.com/DevCop95/aprendepolimorfismo.git
   ```
2. Entra en la carpeta del proyecto:
   ```bash
   cd rpgAPI
   ```
3. Abre el archivo `index.html` directamente en tu navegador favorito, o inicia un servidor local rápido:
   * **Con Python**:
     ```bash
     python -m http.server 8000
     ```
   * **Con Node.js (Live Server / serve)**:
     ```bash
     npx serve .
     ```

---

## 🔗 Despliegue y Enlaces

* **Código de la Aplicación**: [https://github.com/DevCop95/aprendepolimorfismo](https://github.com/DevCop95/aprendepolimorfismo)
* **Demo del Juego (GitHub Pages)**: [https://devcop95.github.io/aprendepolimorfismo/](https://devcop95.github.io/aprendepolimorfismo/)
* **Base de Datos API de personajes**: [https://github.com/DevCop95/rpgdevAPI](https://github.com/DevCop95/rpgdevAPI)
