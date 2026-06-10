/* ==========================================================================
   RPG OOP Arena - JS Logic
   ========================================================================== */

// Base URL de la API de DevCop95
const API_BASE_URL = "https://raw.githubusercontent.com/DevCop95/rpgdevAPI/main";

// --- JERARQUÍA DE CLASES (OOP Y POLIMORFISMO) ---

// Clase Base
class Character {
    constructor(data) {
        this.id = data.id;
        this.nombre = data.nombre;
        this.name = data.name;
        this.titulo = data.titulo;
        this.title = data.title;
        this.tipo = data.tipo;
        this.type = data.type;
        this.elemento = data.elemento;
        this.element = data.element;
        this.rareza = data.rareza;
        this.rarity = data.rarity;
        
        // Atributos base
        this.stats = { ...data.stats };
        this.maxHp = data.stats.hp;
        this.maxMana = data.stats.mana;
        this.hp = data.stats.hp;
        this.mana = data.stats.mana;
        
        // Habilidades e imágenes
        this.habilidades = data.habilidades;
        this.imagenes = data.imagenes;
        
        // Fortalezas, debilidades e historia de la API
        this.fortalezas = data.fortalezas || data.strengths || [];
        this.debilidades = data.debilidades || data.weaknesses || [];
        this.historia = data.historia || data.lore || "No hay historia registrada.";
        
        // Estados en batalla
        this.statusEffects = {}; // e.g., { "taunt": 2, "shield": 1 }
        this.shieldPoints = 0;   // Puntos de escudo de absorción
        this.flashType = null;   // Para efectos visuales ('damage', 'heal', 'shield')
    }

    getHpPercentage() {
        return Math.max(0, Math.min(100, (this.hp / this.maxHp) * 100));
    }

    getManaPercentage() {
        if (this.maxMana === 0) return 0;
        return Math.max(0, Math.min(100, (this.mana / this.maxMana) * 100));
    }

    // Método virtual de daño
    takeDamage(amount, type = "physical", attacker = null) {
        let absorbed = 0;
        let finalDamage = amount;

        // 1. Absorción por puntos de escudo (común a todos los que tengan escudo activo)
        if (this.shieldPoints > 0) {
            let shieldBefore = this.shieldPoints;
            this.shieldPoints = Math.max(0, this.shieldPoints - finalDamage);
            absorbed = shieldBefore - this.shieldPoints;
            finalDamage = Math.max(0, finalDamage - absorbed);
        }

        // 2. Mitigación estándar por defensa
        if (finalDamage > 0) {
            let defReduction = type === "physical" ? this.stats.defense : (this.stats.magic_resistance || 0);
            // Reducción básica: daño = daño - defensa (mínimo 1)
            finalDamage = Math.max(1, finalDamage - defReduction);
            this.hp = Math.max(0, this.hp - finalDamage);
        }

        this.flashType = "damage";
        
        return { 
            damage: finalDamage, 
            absorbed, 
            reflected: 0,
            effects: absorbed > 0 ? [`Escudo absorbió ${absorbed}`] : [] 
        };
    }

    // Método virtual de ejecución de acción
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        const baseDmg = ability.danio_base || ability.base_damage || 60;
        
        // Llamada polimórfica a takeDamage en el objetivo
        const result = target.takeDamage(baseDmg, "physical", this);
        this.flashType = "damage";
        
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: `[Base Character] ${this.nombre} usa '${ability.nombre}' en ${target.nombre} causando ${result.damage} de daño.`
        };
    }

    applyStatus(effect, duration = 2) {
        this.statusEffects[effect] = duration;
    }

    decrementStatuses() {
        for (let effect in this.statusEffects) {
            if (this.statusEffects[effect] > 0) {
                this.statusEffects[effect]--;
                if (this.statusEffects[effect] === 0) {
                    delete this.statusEffects[effect];
                }
            }
        }
    }

    hasStatus(effect) {
        return !!this.statusEffects[effect];
    }
}

// Subclase Guerrero (Tank)
class Warrior extends Character {
    constructor(data) {
        super(data);
        this.shieldActive = false;
    }

    // POLIMORFISMO: El Guerrero sobrescribe takeDamage para aplicar bloqueo con escudo
    takeDamage(amount, type = "physical", attacker = null) {
        let absorbed = 0;
        let finalDamage = amount;

        // Bloqueo con Escudo: 60% si está activo, 25% pasivo constante
        if (type === "physical") {
            let blockRate = this.shieldActive ? 0.60 : 0.25;
            let damageBefore = finalDamage;
            finalDamage = Math.round(damageBefore * (1 - blockRate));
            absorbed = damageBefore - finalDamage;
        }

        // Mitigación por defensa adicional
        finalDamage = Math.max(1, finalDamage - this.stats.defense);
        this.hp = Math.max(0, this.hp - finalDamage);
        
        this.flashType = this.shieldActive ? "shield" : "damage";
        
        let effects = [];
        if (absorbed > 0) effects.push(`Bloqueo de Escudo (${Math.round(absorbed)} Absorbido)`);

        return { damage: finalDamage, absorbed, reflected: 0, effects };
    }

    // POLIMORFISMO: Habilidades de tanque de Guerrero
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];

        if (abilityIndex === 1) { // Habilidad 2: Generalmente "Muro de Escudos" o defensivo
            this.shieldActive = true;
            this.applyStatus("shield", 2);
            this.flashType = "shield";
            return {
                abilityName: ability.nombre,
                type: "shield",
                text: `[Polimorfismo en Guerrero] ${this.nombre} activa '${ability.nombre}'. Reduce un 60% del daño físico durante 2 turnos.`
            };
        }

        if (abilityIndex === 2) { // Habilidad 3: Provocación o Taunt
            target.applyStatus("taunt", 2);
            this.shieldActive = false;
            return {
                abilityName: ability.nombre,
                type: "status",
                text: `[Polimorfismo en Guerrero] ${this.nombre} ruge con '${ability.nombre}'. ${target.nombre} queda Provocado (Taunted) por 2 turnos.`
            };
        }

        // Habilidad 1: Ataque físico básico
        this.shieldActive = false;
        const baseDmg = ability.danio_base || ability.base_damage || 70;
        const result = target.takeDamage(baseDmg, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: `[Polimorfismo en Guerrero] ${this.nombre} golpea con '${ability.nombre}' a ${target.nombre} infligiendo ${result.damage} de daño.`
        };
    }
}

// Subclase Berserker (Furia / Sangre)
class Berserker extends Character {
    constructor(data) {
        super(data);
        this.furyMultiplier = 1.0;
    }

    // POLIMORFISMO: Berserker gana Furia a medida que pierde HP, multiplicando su daño
    takeDamage(amount, type = "physical", attacker = null) {
        const result = super.takeDamage(amount, type, attacker);
        
        // Multiplicador de Furia: +1% de daño por cada 1% de HP faltante (hasta 2x daño)
        let hpPct = this.hp / this.maxHp;
        this.furyMultiplier = 1.0 + (1.0 - hpPct);
        
        if (this.furyMultiplier > 1.25) {
            this.applyStatus("fury", 3);
        }
        
        result.effects.push(`Furia aumenta a x${this.furyMultiplier.toFixed(2)}`);
        return result;
    }

    // POLIMORFISMO: Berserker tiene habilidades que cuestan HP propio pero causan daño incrementado por la Furia
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        
        // Habilidad 2 (Sacrificio / Frenesí) cuesta 12% de HP
        let hpCost = 0;
        if (abilityIndex === 1) {
            hpCost = Math.round(this.maxHp * 0.12);
            this.hp = Math.max(1, this.hp - hpCost); // Nunca muere por autodamage
            this.flashType = "damage";
        }

        let baseDmg = ability.danio_base || ability.base_damage || 80;
        // Aplica el multiplicador de Furia
        let totalDmg = Math.round(baseDmg * this.furyMultiplier);
        
        const result = target.takeDamage(totalDmg, "physical", this);
        
        let text = `[Polimorfismo en Berserker] ${this.nombre} ejecuta '${ability.nombre}' infligiendo ${result.damage} de daño físico (aumentado x${this.furyMultiplier.toFixed(2)} por Furia).`;
        if (hpCost > 0) {
            text += ` Sacrificó ${hpCost} de su propia vida.`;
        }

        // Recalcular furia tras autodamage
        let hpPct = this.hp / this.maxHp;
        this.furyMultiplier = 1.0 + (1.0 - hpPct);

        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            selfDamage: hpCost,
            text: text
        };
    }
}

// Subclase Mago (Magia / Maná)
class Mage extends Character {
    // POLIMORFISMO: Sus habilidades consumen maná y causan daño mágico que ignora defensa física
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        
        // Habilidades especiales requieren maná
        let manaCost = 0;
        if (abilityIndex > 0) {
            manaCost = abilityIndex === 1 ? 25 : 40; // Costo estimado de maná
        }

        if (this.mana < manaCost) {
            return {
                abilityName: ability.nombre,
                type: "fail",
                text: `[Polimorfismo en Mago] ${this.nombre} intenta usar '${ability.nombre}' pero no tiene suficiente Maná (Requiere ${manaCost}, actual: ${this.mana}).`
            };
        }

        this.mana -= manaCost;

        // Regeneración pasiva menor en el ataque básico
        if (abilityIndex === 0) {
            this.mana = Math.min(this.maxMana, this.mana + 15);
        }

        let baseDmg = ability.danio_base || ability.base_damage || 70;
        
        // Daño Mágico: Ignora la defensa física estándar. Usa la resistencia mágica del objetivo.
        let magicResist = target.stats.magic_resistance || 20;
        let reduction = magicResist / (magicResist + 100); // ej. 50 RM = 33% reducción
        let damageDone = Math.round(baseDmg * (1 - reduction));

        // Aplica el daño al objetivo
        const result = target.takeDamage(damageDone, "magic", this);

        let text = `[Polimorfismo en Mago] ${this.nombre} gasta ${manaCost} de Maná y lanza '${ability.nombre}' sobre ${target.nombre} causando ${result.damage} de daño mágico.`;
        if (abilityIndex === 0) {
            text = `[Polimorfismo en Mago] ${this.nombre} ataca con '${ability.nombre}' a ${target.nombre} causando ${result.damage} de daño y recupera 15 de Maná.`;
        }

        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            manaCost: manaCost,
            text: text
        };
    }
}

// Subclases de Soporte: Clérigo y Curandera
class Cleric extends Character {
    // POLIMORFISMO: Clérigo puede sanar aliados y aplicar escudos mágicos
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        const manaCost = abilityIndex === 0 ? 0 : (abilityIndex === 1 ? 20 : 35);

        if (this.mana < manaCost) {
            return {
                abilityName: ability.nombre,
                type: "fail",
                text: `[Polimorfismo en Clérigo] ${this.nombre} no tiene suficiente Maná para '${ability.nombre}' (Requiere ${manaCost}).`
            };
        }

        this.mana -= manaCost;

        // Habilidad 2: Curación Directa
        if (abilityIndex === 1) {
            let healPower = ability.danio_base || ability.base_damage || 100;
            // Cura al aliado seleccionado
            let ally = teamAllies.length > 0 ? teamAllies[0] : this; // Si es 1v1 se cura a sí mismo
            let healAmount = Math.round(healPower * 1.2);
            
            ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
            ally.flashType = "heal";

            return {
                abilityName: ability.nombre,
                type: "heal",
                heal: healAmount,
                manaCost,
                text: `[Polimorfismo en Clérigo] ${this.nombre} canaliza '${ability.nombre}' y cura a ${ally.nombre} por ${healAmount} de HP.`
            };
        }

        // Habilidad 3: Escudo Sagrado
        if (abilityIndex === 2) {
            let shieldAmount = Math.round(this.maxHp * 0.18); // Escudo de 18% de su HP Max
            let ally = teamAllies.length > 0 ? teamAllies[0] : this;
            ally.shieldPoints = shieldAmount;
            ally.applyStatus("shield", 2);
            ally.flashType = "shield";

            return {
                abilityName: ability.nombre,
                type: "shield",
                shield: shieldAmount,
                manaCost,
                text: `[Polimorfismo en Clérigo] ${this.nombre} conjura '${ability.nombre}' sobre ${ally.nombre}, otorgándole un Escudo de Luz de ${shieldAmount} puntos.`
            };
        }

        // Habilidad 1: Ataque básico
        const baseDmg = ability.danio_base || 50;
        const result = target.takeDamage(baseDmg, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: `[Polimorfismo en Clérigo] ${this.nombre} ataca con '${ability.nombre}' a ${target.nombre} causando ${result.damage} de daño.`
        };
    }
}

class Healer extends Character {
    // POLIMORFISMO: Curandera se enfoca completamente en regeneración de salud
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        const manaCost = abilityIndex === 0 ? 0 : 25;

        if (this.mana < manaCost) {
            return {
                abilityName: ability.nombre,
                type: "fail",
                text: `[Polimorfismo en Curandera] ${this.nombre} no tiene maná para '${ability.nombre}' (Requiere ${manaCost}).`
            };
        }

        this.mana -= manaCost;

        // Habilidades de Curación
        if (abilityIndex > 0) {
            let healPower = ability.danio_base || ability.base_damage || 90;
            let ally = teamAllies.length > 0 ? teamAllies[0] : this;
            
            // Si el aliado tiene salud muy baja, la curación es un 50% más fuerte (Pasiva de curandera)
            let critHeal = false;
            if (ally.hp < ally.maxHp * 0.35) {
                healPower = Math.round(healPower * 1.5);
                critHeal = true;
            }

            ally.hp = Math.min(ally.maxHp, ally.hp + healPower);
            ally.flashType = "heal";

            return {
                abilityName: ability.nombre,
                type: "heal",
                heal: healPower,
                manaCost,
                text: `[Polimorfismo en Curandera] ${this.nombre} usa '${ability.nombre}' en ${ally.nombre} curando ${healPower} de HP${critHeal ? " (¡Bono de salud crítica activo!)" : ""}.`
            };
        }

        // Habilidad 1: Golpes florales/básicos
        const result = target.takeDamage(45, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: `[Polimorfismo en Curandera] ${this.nombre} golpea con '${ability.nombre}' a ${target.nombre} causando ${result.damage} de daño.`
        };
    }
}

// Subclase Ninja (Evasión / Agilidad)
class Ninja extends Character {
    // POLIMORFISMO: Ninja sobrescribe takeDamage para evadir ataques físicos basados en su velocidad
    takeDamage(amount, type = "physical", attacker = null) {
        if (type === "physical") {
            // Evasión basada en velocidad: velocidad / 250 (ej. 60 velocidad = 24% evasión)
            let evasionChance = (this.stats.speed || 60) / 250;
            if (Math.random() < evasionChance) {
                this.flashType = "heal"; // Usamos flash verde para denotar la esquiva exitosa
                return {
                    damage: 0,
                    absorbed: 0,
                    reflected: 0,
                    effects: ["¡Esquivado! (Ninja Dodge)"]
                };
            }
        }

        // Si no esquiva, recibe daño normal mitigado por defensa
        let finalDamage = Math.max(1, amount - this.stats.defense);
        this.hp = Math.max(0, this.hp - finalDamage);
        
        this.flashType = "damage";
        return { damage: finalDamage, absorbed: 0, reflected: 0, effects: [] };
    }

    // POLIMORFISMO: Ninja puede ejecutar ataques críticos y ataques dobles
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        
        // Habilidad 2: Ataque Doble
        if (abilityIndex === 1) {
            let baseDmg = Math.round((ability.danio_base || ability.base_damage || 60) * 0.7); // daño por golpe
            
            // Primer golpe
            const res1 = target.takeDamage(baseDmg, "physical", this);
            // Segundo golpe
            const res2 = target.takeDamage(baseDmg, "physical", this);
            
            let totalDmg = res1.damage + res2.damage;
            return {
                abilityName: ability.nombre,
                type: "damage",
                damage: totalDmg,
                text: `[Polimorfismo en Ninja] ${this.nombre} ataca desde las sombras con '${ability.nombre}' (Daño Doble) a ${target.nombre} infligiendo ${res1.damage} y ${res2.damage} de daño (Total: ${totalDmg}).`
            };
        }

        // Habilidad 3: Ataque Crítico Letal
        if (abilityIndex === 2) {
            let baseDmg = ability.danio_base || ability.base_damage || 80;
            // Probabilidad crítica del Ninja es alta
            let critRoll = Math.random() < 0.6; // 60% probabilidad crítico
            let dmg = critRoll ? Math.round(baseDmg * 2.2) : baseDmg;
            
            const result = target.takeDamage(dmg, "physical", this);
            return {
                abilityName: ability.nombre,
                type: "damage",
                damage: result.damage,
                text: `[Polimorfismo en Ninja] ${this.nombre} usa '${ability.nombre}' en ${target.nombre} causando ${result.damage} de daño ${critRoll ? "(¡GOLPE CRÍTICO x2.2!)" : "(Impacto estándar)"}.`
            };
        }

        // Ataque básico
        const baseDmg = ability.danio_base || 65;
        const result = target.takeDamage(baseDmg, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: `[Polimorfismo en Ninja] ${this.nombre} corta con '${ability.nombre}' a ${target.nombre} causando ${result.damage} de daño.`
        };
    }
}

// Subclase Templario (Paladín / Reflejo)
class Templar extends Character {
    constructor(data) {
        super(data);
        this.lightBarrier = 0;
    }

    // POLIMORFISMO: Templario tiene una barrera que absorbe daño y refleja el 20% al atacante
    takeDamage(amount, type = "physical", attacker = null) {
        let absorbed = 0;
        let finalDamage = amount;

        // 1. Consume Barrera de Luz primero
        if (this.lightBarrier > 0) {
            let barrierBefore = this.lightBarrier;
            this.lightBarrier = Math.max(0, this.lightBarrier - finalDamage);
            absorbed = barrierBefore - this.lightBarrier;
            finalDamage = Math.max(0, finalDamage - absorbed);
        }

        // 2. Mitigación física/mágica por defensa
        if (finalDamage > 0) {
            let def = type === "physical" ? this.stats.defense : (this.stats.magic_resistance || 25);
            finalDamage = Math.max(1, finalDamage - def);
            this.hp = Math.max(0, this.hp - finalDamage);
        }

        // 3. REFLEJO SAGRADO: Si recibe daño y el atacante existe, refleja 20%
        let reflected = 0;
        if (attacker && finalDamage > 0) {
            reflected = Math.round(finalDamage * 0.20);
            attacker.takeDamage(reflected, "holy", null); // Daño sagrado directo
        }

        this.flashType = absorbed > 0 ? "shield" : "damage";

        let effects = [];
        if (absorbed > 0) effects.push(`Barrera absorbió ${absorbed}`);
        if (reflected > 0) effects.push(`¡Reflejo Sagrado! devolvió ${reflected} de daño`);

        return { damage: finalDamage, absorbed, reflected, effects };
    }

    // POLIMORFISMO: Combina defensa y curación menor al atacar
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        
        // Habilidad 3: Escudo del Amanecer (genera barrera)
        if (abilityIndex === 2) {
            let barrierVal = Math.round(this.maxHp * 0.22); // Barrera del 22% de su HP Max
            this.lightBarrier = barrierVal;
            this.applyStatus("shield", 2);
            this.flashType = "shield";
            return {
                abilityName: ability.nombre,
                type: "shield",
                shield: barrierVal,
                text: `[Polimorfismo en Templario] ${this.nombre} alza su maza con '${ability.nombre}'. Se cubre con una Barrera de Luz de ${barrierVal} de absorción.`
            };
        }

        // Habilidad 2: Golpe Sagrado (daño + curación menor pasiva al templario)
        if (abilityIndex === 1) {
            let baseDmg = ability.danio_base || ability.base_damage || 70;
            const result = target.takeDamage(baseDmg, "physical", this);
            
            // Cura pasiva
            let healAmount = Math.round(baseDmg * 0.45); // Sana 45% del daño base
            this.hp = Math.min(this.maxHp, this.hp + healAmount);
            
            return {
                abilityName: ability.nombre,
                type: "damage",
                damage: result.damage,
                heal: healAmount,
                text: `[Polimorfismo en Templario] ${this.nombre} ejecuta '${ability.nombre}' contra ${target.nombre} haciendo ${result.damage} de daño. Su fe restaura ${healAmount} de su HP.`
            };
        }

        // Habilidad 1: Ataque básico
        const baseDmg = ability.danio_base || 60;
        const result = target.takeDamage(baseDmg, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: `[Polimorfismo en Templario] ${this.nombre} golpea con '${ability.nombre}' a ${target.nombre} haciendo ${result.damage} de daño.`
        };
    }
}


// --- FACTORY PATTERN PARA CREACIÓN DE PERSONAJES ---
class CharacterFactory {
    static create(data) {
        const id = data.id.toLowerCase();
        
        switch(id) {
            case "guerrero":
                return new Warrior(data);
            case "berserker":
                return new Berserker(data);
            case "mago":
                return new Mage(data);
            case "clerigo":
                return new Cleric(data);
            case "curandera":
                return new Healer(data);
            case "ninja":
                return new Ninja(data);
            case "templario":
                return new Templar(data);
            default:
                return new Character(data); // Fallback a clase base común
        }
    }
}


// --- CÓDIGOS FUENTE PARA EL INSPECTOR DE CÓDIGO (MOSTRAR POLIMORFISMO) ---
const SUBCLASS_CODES = {
    guerrero: `// Clase Guerrero (Guerrero / Tanque)
class Warrior extends Character {
    constructor(data) {
        super(data);
        this.shieldActive = false; // Estado del escudo
    }

    // POLIMORFISMO: Guerrero sobrescribe takeDamage para aplicar bloqueo
    takeDamage(amount, type = "physical", attacker = null) {
        let absorbed = 0;
        let finalDamage = amount;

        // Bloqueo con Escudo: 60% si está activo, 25% pasivo constante
        if (type === "physical") {
            let blockRate = this.shieldActive ? 0.60 : 0.25;
            let damageBefore = finalDamage;
            finalDamage = Math.round(damageBefore * (1 - blockRate));
            absorbed = damageBefore - finalDamage;
        }

        // Mitigación por defensa estándar
        finalDamage = Math.max(1, finalDamage - this.stats.defense);
        this.hp = Math.max(0, this.hp - finalDamage);
        
        this.flashType = this.shieldActive ? "shield" : "damage";
        
        let effects = [];
        if (absorbed > 0) effects.push(\`Bloqueo de Escudo (\${Math.round(absorbed)} Absorbido)\`);

        return { damage: finalDamage, absorbed, reflected: 0, effects };
    }

    // POLIMORFISMO: Habilidades defensivas sobrescritas
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];

        if (abilityIndex === 1) { // Muro de Escudos
            this.shieldActive = true;
            this.applyStatus("shield", 2);
            return {
                abilityName: ability.nombre,
                type: "shield",
                text: \`[Polimorfismo] \${this.nombre} activa '\${ability.nombre}'. Bloquea 60% daño entrante por 2 turnos.\`
            };
        }

        if (abilityIndex === 2) { // Provocar / Taunt
            target.applyStatus("taunt", 2);
            this.shieldActive = false;
            return {
                abilityName: ability.nombre,
                type: "status",
                text: \`[Polimorfismo] \${this.nombre} usa '\${ability.nombre}'. \${target.nombre} queda Provocado.\`
            };
        }

        // Ataque Básico
        this.shieldActive = false;
        const result = target.takeDamage(ability.danio_base || 70, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: \`[Polimorfismo] \${this.nombre} ataca con '\${ability.nombre}', causando \${result.damage} de daño.\`
        };
    }
}`,
    berserker: `// Clase Berserker (Furia / Sangre)
class Berserker extends Character {
    constructor(data) {
        super(data);
        this.furyMultiplier = 1.0; // Daño incrementado a menor vida
    }

    // POLIMORFISMO: Sobrescribe takeDamage para ganar Furia al ser golpeado
    takeDamage(amount, type = "physical", attacker = null) {
        const result = super.takeDamage(amount, type, attacker);
        
        // Furia: +1% de daño por cada 1% de HP faltante (daño extra hasta x2)
        let hpPct = this.hp / this.maxHp;
        this.furyMultiplier = 1.0 + (1.0 - hpPct);
        
        if (this.furyMultiplier > 1.25) {
            this.applyStatus("fury", 3);
        }
        
        result.effects.push(\`Furia aumenta a x\${this.furyMultiplier.toFixed(2)}\`);
        return result;
    }

    // POLIMORFISMO: Acciones que cuestan vida y golpean con Furia
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        
        // Habilidad 2 (Sacrificio) cuesta 12% de HP
        let hpCost = 0;
        if (abilityIndex === 1) {
            hpCost = Math.round(this.maxHp * 0.12);
            this.hp = Math.max(1, this.hp - hpCost); // Daño propio
        }

        let baseDmg = ability.danio_base || 80;
        let totalDmg = Math.round(baseDmg * this.furyMultiplier); // Multiplica daño
        
        const result = target.takeDamage(totalDmg, "physical", this);
        
        // Recalcular furia por pérdida de HP propio
        let hpPct = this.hp / this.maxHp;
        this.furyMultiplier = 1.0 + (1.0 - hpPct);

        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            selfDamage: hpCost,
            text: \`[Polimorfismo] \${this.nombre} usa '\${ability.nombre}' causando \${result.damage} de daño (x\${this.furyMultiplier.toFixed(2)} de Furia). Sacrifica \${hpCost} HP.\`
        };
    }
}`,
    mago: `// Clase Mago (Magia / Maná)
class Mage extends Character {
    // POLIMORFISMO: Consume maná para lanzar potentes conjuros mágicos
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        
        let manaCost = 0;
        if (abilityIndex > 0) {
            manaCost = abilityIndex === 1 ? 25 : 40; // Gasta Maná
        }

        if (this.mana < manaCost) {
            return {
                abilityName: ability.nombre,
                type: "fail",
                text: \`[Polimorfismo] \${this.nombre} no tiene Maná para lanzar '\${ability.nombre}' (Falta \${manaCost - this.mana}).\`
            };
        }

        this.mana -= manaCost;

        // Regeneración menor en ataque básico
        if (abilityIndex === 0) {
            this.mana = Math.min(this.maxMana, this.mana + 15);
        }

        let baseDmg = ability.danio_base || 70;
        
        // Daño Mágico: Ignora la defensa física estándar. Se atenúa con Resistencia Mágica.
        let magicResist = target.stats.magic_resistance || 20;
        let reduction = magicResist / (magicResist + 100);
        let damageDone = Math.round(baseDmg * (1 - reduction));

        // Aplica el daño al objetivo
        const result = target.takeDamage(damageDone, "magic", this);

        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            manaCost: manaCost,
            text: \`[Polimorfismo] \${this.nombre} gasta \${manaCost} Maná y conjura '\${ability.nombre}' causando \${result.damage} de daño mágico a \${target.nombre}.\`
        };
    }
}`,
    clerigo: `// Clase Clérigo (Luz / Híbrido Curación y Escudos)
class Cleric extends Character {
    // POLIMORFISMO: Cura aliados y crea escudos sagrados
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        const manaCost = abilityIndex === 0 ? 0 : (abilityIndex === 1 ? 20 : 35);

        if (this.mana < manaCost) {
            return {
                abilityName: ability.nombre,
                type: "fail",
                text: \`[Polimorfismo] Sin Maná suficiente para '\${ability.nombre}' (Requiere \${manaCost}).\`
            };
        }
        this.mana -= manaCost;

        // Curar Aliado
        if (abilityIndex === 1) {
            let healPower = ability.danio_base || 100;
            let ally = teamAllies.length > 0 ? teamAllies[0] : this;
            let healAmount = Math.round(healPower * 1.2);
            
            ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
            return {
                abilityName: ability.nombre,
                type: "heal",
                heal: healAmount,
                text: \`[Polimorfismo] \${this.nombre} usa '\${ability.nombre}' y sana a \${ally.nombre} por \${healAmount} HP.\`
            };
        }

        // Crear Escudo Mágico
        if (abilityIndex === 2) {
            let shieldAmount = Math.round(this.maxHp * 0.18);
            let ally = teamAllies.length > 0 ? teamAllies[0] : this;
            ally.shieldPoints = shieldAmount;
            ally.applyStatus("shield", 2);
            return {
                abilityName: ability.nombre,
                type: "shield",
                shield: shieldAmount,
                text: \`[Polimorfismo] \${this.nombre} otorga un Escudo de Luz de \${shieldAmount} absorción a \${ally.nombre}.\`
            };
        }

        // Ataque básico
        const result = target.takeDamage(ability.danio_base || 50, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: \`[Polimorfismo] \${this.nombre} golpea con '\${ability.nombre}' infligiendo \${result.damage} de daño.\`
        };
    }
}`,
    curandera: `// Clase Curandera (Soporte de Curación Pura)
class Healer extends Character {
    // POLIMORFISMO: Se enfoca puramente en restaurar vida con bonos críticos
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        const manaCost = abilityIndex === 0 ? 0 : 25;

        if (this.mana < manaCost) {
            return {
                abilityName: ability.nombre,
                type: "fail",
                text: \`[Polimorfismo] \${this.nombre} no tiene maná suficiente.\`
            };
        }
        this.mana -= manaCost;

        // Curaciones (Habilidad 2 y 3)
        if (abilityIndex > 0) {
            let healPower = ability.danio_base || 90;
            let ally = teamAllies.length > 0 ? teamAllies[0] : this;
            
            // Pasiva: Cura 50% más fuerte si la salud del aliado está por debajo del 35%
            let critHeal = false;
            if (ally.hp < ally.maxHp * 0.35) {
                healPower = Math.round(healPower * 1.5);
                critHeal = true;
            }

            ally.hp = Math.min(ally.maxHp, ally.hp + healPower);
            return {
                abilityName: ability.nombre,
                type: "heal",
                heal: healPower,
                text: \`[Polimorfismo] \${this.nombre} usa '\${ability.nombre}' y sana \${healPower} HP a \${ally.nombre}\${critHeal ? " (¡Bono Salud Crítica!)" : ""}.\`
            };
        }

        // Ataque Básico
        const result = target.takeDamage(45, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: \`[Polimorfismo] Curandera golpea con '\${ability.nombre}' causando \${result.damage} de daño.\`
        };
    }
}`,
    ninja: `// Clase Ninja (Velocidad / Evasión / Críticos)
class Ninja extends Character {
    // POLIMORFISMO: Evasión física aleatoria basada en su velocidad (Stats pasivos)
    takeDamage(amount, type = "physical", attacker = null) {
        if (type === "physical") {
            // Velocidad influye en la evasión física (e.g. 60 vel = 24% esquiva)
            let evasionChance = (this.stats.speed || 60) / 250;
            if (Math.random() < evasionChance) {
                return {
                    damage: 0,
                    absorbed: 0,
                    reflected: 0,
                    effects: ["¡Esquivado! (Ninja Dodge)"]
                };
            }
        }

        let finalDamage = Math.max(1, amount - this.stats.defense);
        this.hp = Math.max(0, this.hp - finalDamage);
        return { damage: finalDamage, absorbed: 0, reflected: 0, effects: [] };
    }

    // POLIMORFISMO: Ejecuta ataques múltiples o con alta tasa de crítico
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        
        // Habilidad 2: Ataque Doble
        if (abilityIndex === 1) {
            let baseDmg = Math.round((ability.danio_base || 60) * 0.7);
            
            const res1 = target.takeDamage(baseDmg, "physical", this);
            const res2 = target.takeDamage(baseDmg, "physical", this);
            let total = res1.damage + res2.damage;
            
            return {
                abilityName: ability.nombre,
                type: "damage",
                damage: total,
                text: \`[Polimorfismo] \${this.nombre} golpea dos veces con '\${ability.nombre}' infligiendo \${res1.damage} y \${res2.damage} de daño.\`
            };
        }

        // Habilidad 3: Ataque Crítico de Evasión
        if (abilityIndex === 2) {
            let baseDmg = ability.danio_base || 80;
            let critRoll = Math.random() < 0.60; // 60% críticos
            let dmg = critRoll ? Math.round(baseDmg * 2.2) : baseDmg;
            
            const result = target.takeDamage(dmg, "physical", this);
            return {
                abilityName: ability.nombre,
                type: "damage",
                damage: result.damage,
                text: \`[Polimorfismo] \${this.nombre} usa '\${ability.nombre}' causando \${result.damage} de daño \${critRoll ? "(¡GOLPE CRÍTICO x2.2!)" : ""}.\`
            };
        }

        // Ataque básico
        const result = target.takeDamage(ability.danio_base || 65, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: \`[Polimorfismo] \${this.nombre} ataca con '\${ability.nombre}' haciendo \${result.damage} de daño.\`
        };
    }
}`,
    templario: `// Clase Templario (Paladín / Daño Sagrado / Reflejo)
class Templar extends Character {
    constructor(data) {
        super(data);
        this.lightBarrier = 0; // Barrera sagrada activa
    }

    // POLIMORFISMO: Templario absorbe daño con su barrera y refleja 20% al atacante
    takeDamage(amount, type = "physical", attacker = null) {
        let absorbed = 0;
        let finalDamage = amount;

        // Absorción de Barrera
        if (this.lightBarrier > 0) {
            let barrierBefore = this.lightBarrier;
            this.lightBarrier = Math.max(0, this.lightBarrier - finalDamage);
            absorbed = barrierBefore - this.lightBarrier;
            finalDamage = Math.max(0, finalDamage - absorbed);
        }

        // Defensa base
        if (finalDamage > 0) {
            let def = type === "physical" ? this.stats.defense : (this.stats.magic_resistance || 25);
            finalDamage = Math.max(1, finalDamage - def);
            this.hp = Math.max(0, this.hp - finalDamage);
        }

        // Reflejo Sagrado (Devuelve daño directo al atacante)
        let reflected = 0;
        if (attacker && finalDamage > 0) {
            reflected = Math.round(finalDamage * 0.20);
            attacker.takeDamage(reflected, "holy", null);
        }

        this.flashType = absorbed > 0 ? "shield" : "damage";
        let effects = [];
        if (absorbed > 0) effects.push(\`Barrera absorbió \${absorbed}\`);
        if (reflected > 0) effects.push(\`¡Reflejo Sagrado! devolvió \${reflected} de daño\`);

        return { damage: finalDamage, absorbed, reflected, effects };
    }

    // POLIMORFISMO: Habilidades híbridas curativas y de escudo
    executeAction(abilityIndex, target, teamAllies = [], teamEnemies = []) {
        const ability = this.habilidades[abilityIndex];
        
        // Habilidad 3: Escudo del Amanecer (Genera Barrera)
        if (abilityIndex === 2) {
            let barrierVal = Math.round(this.maxHp * 0.22);
            this.lightBarrier = barrierVal;
            this.applyStatus("shield", 2);
            return {
                abilityName: ability.nombre,
                type: "shield",
                text: \`[Polimorfismo] \${this.nombre} invoca '\${ability.nombre}' y gana una Barrera Sagrada de \${barrierVal}.\`
            };
        }

        // Habilidad 2: Golpe Sagrado (Cura al Templario al golpear)
        if (abilityIndex === 1) {
            let baseDmg = ability.danio_base || 70;
            const result = target.takeDamage(baseDmg, "physical", this);
            
            let healAmount = Math.round(baseDmg * 0.45);
            this.hp = Math.min(this.maxHp, this.hp + healAmount);
            
            return {
                abilityName: ability.nombre,
                type: "damage",
                damage: result.damage,
                text: \`[Polimorfismo] \${this.nombre} usa '\${ability.nombre}' infligiendo \${result.damage} de daño. Recupera \${healAmount} HP.\`
            };
        }

        // Ataque básico
        const result = target.takeDamage(ability.danio_base || 60, "physical", this);
        return {
            abilityName: ability.nombre,
            type: "damage",
            damage: result.damage,
            text: \`[Polimorfismo] \${this.nombre} golpea con '\${ability.nombre}' haciendo \${result.damage} de daño.\`
        };
    }
}`
};


// --- ESTADO GENERAL DE LA APLICACIÓN ---
const state = {
    charactersData: [], // Almacena los JSON planos de la API
    loadedCharacters: {}, // Almacena instancias de Character creadas por el Factory
    selectedLibraryCharacter: null, // El personaje seleccionado para inspeccionar en la biblioteca
    
    // Configuración de la Arena
    fighters: {
        player: null, // Instancia del combatiente jugador
        enemy: null  // Instancia del combatiente enemigo
    },
    
    battleActive: false,
    currentTurn: "player", // 'player' o 'enemy'
    turnNumber: 0
};


// --- CONSUMO DE LA API ---
async function fetchCharacters() {
    updateApiStatus("loading", "Cargando biblioteca...");
    
    try {
        // 1. Fetch al índice general
        const indexResponse = await fetch(`${API_BASE_URL}/index.json`);
        if (!indexResponse.ok) throw new Error("No se pudo cargar el index.json");
        const indexData = await indexResponse.ok ? await indexResponse.json() : null;
        
        // Como a veces el index de GitHub Raw puede dar fallos de caché o red, definimos el array de personajes fijo para mayor estabilidad.
        // Los endpoints están en el index.json, pero consultaremos directamente a cada personaje.
        const characterIds = ["guerrero", "berserker", "ninja", "clerigo", "curandera", "mago", "templario"];
        
        const fetchPromises = characterIds.map(async (id) => {
            const res = await fetch(`${API_BASE_URL}/data/${id}.json`);
            if (!res.ok) throw new Error(`Error al cargar el personaje ${id}`);
            return res.json();
        });
        
        state.charactersData = await Promise.all(fetchPromises);
        
        // Instanciar personajes usando el Factory y almacenarlos
        state.charactersData.forEach(charJson => {
            state.loadedCharacters[charJson.id] = CharacterFactory.create(charJson);
        });
        
        updateApiStatus("loaded", "API Cargada");
        logCombat("Sistema", "Se han cargado correctamente los datos de los 7 personajes RPG de la API de DevCop95.");
        
        // Renderizar la biblioteca
        renderLibrary();
        
        // Habilitar botones de asignar héroes
        document.getElementById("btn-add-player").removeAttribute("disabled");
        document.getElementById("btn-add-enemy").removeAttribute("disabled");
        document.getElementById("btn-random-vs")?.removeAttribute("disabled");
        document.getElementById("btn-inspect-selected")?.removeAttribute("disabled");
        document.getElementById("btn-sheet-selected")?.removeAttribute("disabled");
        
        // Por defecto pre-asignar e inspeccionar los combatientes iniciales
        state.selectedLibraryCharacter = "guerrero";
        assignFighter("player");
        state.selectedLibraryCharacter = "berserker";
        assignFighter("enemy");
        selectLibraryCharacter("guerrero");
        
    } catch (error) {
        console.error("Error cargando la API:", error);
        updateApiStatus("error", "Error de Carga");
        logCombat("Error", `Fallo al consumir la API: ${error.message}. Por favor recarga la página.`);
    }
}


// --- INTERFAZ Y RENDERIZADO ---

function updateApiStatus(status, text) {
    const el = document.getElementById("api-status");
    el.className = `api-status ${status}`;
    
    if (status === "loading") {
        el.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${text}`;
    } else if (status === "loaded") {
        el.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${text}`;
    } else {
        el.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${text}`;
    }
}

// Renderiza la lista de personajes en la biblioteca izquierda
function renderLibrary() {
    const selector = document.querySelector(".character-selector");
    const title = document.getElementById("char-panel-title");
    if (title) {
        title.innerHTML = `
            <span class="title-text"><i class="fa-solid fa-code-branch"></i> Selector VS</span>
            <span class="api-status-group">
                <span class="api-status loaded" id="api-status"><i class="fa-solid fa-circle-check"></i> API Cargada</span>
                <button class="btn-api-help" id="btn-api-help" title="¿Cómo se conecta con la API?"><i class="fa-solid fa-circle-question"></i></button>
            </span>
        `;
    }
    if (!selector) return;

    selector.innerHTML = `
        <div class="select-field">
            <span><i class="fa-solid fa-shield-halved"></i> Héroe</span>
            <div class="custom-select-wrapper">
                <select id="player-select"></select>
                <i class="fa-solid fa-chevron-down select-arrow"></i>
            </div>
        </div>

        <div class="duel-vs-chip">VS</div>

        <div class="select-field">
            <span><i class="fa-solid fa-skull"></i> Adversario</span>
            <div class="custom-select-wrapper">
                <select id="enemy-select"></select>
                <i class="fa-solid fa-chevron-down select-arrow"></i>
            </div>
        </div>

        <button class="btn btn-primary btn-wide" id="btn-random-vs">
            <i class="fa-solid fa-dice-d20"></i> VS automático
        </button>

        <div class="selector-actions">
            <button class="btn btn-secondary btn-sm" id="btn-inspect-selected">
                <i class="fa-solid fa-code"></i> Inspeccionar
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-sheet-selected">
                <i class="fa-solid fa-scroll"></i> Hoja
            </button>
        </div>

        <div class="selected-code-card" id="selected-code-card">
            <span class="code-card-kicker">Subclase activa</span>
            <strong id="selected-code-name">Character</strong>
            <code id="selected-code-signature">CharacterFactory.create(data)</code>
        </div>
    `;

    populateDuelSelects();
    bindDuelControls();
}

function populateDuelSelects() {
    const playerSelect = document.getElementById("player-select");
    const enemySelect = document.getElementById("enemy-select");
    if (!playerSelect || !enemySelect) return;

    const options = state.charactersData.map(char => {
        const label = `${char.nombre} - ${char.tipo}`;
        return `<option value="${char.id}">${label}</option>`;
    }).join("");

    playerSelect.innerHTML = options;
    enemySelect.innerHTML = options;
    playerSelect.value = state.charactersData[0]?.id || "";
    enemySelect.value = state.charactersData[1]?.id || state.charactersData[0]?.id || "";
}

function bindDuelControls() {
    const playerSelect = document.getElementById("player-select");
    const enemySelect = document.getElementById("enemy-select");
    const randomBtn = document.getElementById("btn-random-vs");
    const inspectBtn = document.getElementById("btn-inspect-selected");
    const sheetBtn = document.getElementById("btn-sheet-selected");
    const autoSelectBtn = document.getElementById("btn-auto-select");

    playerSelect?.addEventListener("change", () => {
        selectLibraryCharacter(playerSelect.value);
        assignFighterFromSelect("player");
    });

    enemySelect?.addEventListener("change", () => {
        selectLibraryCharacter(enemySelect.value);
        assignFighterFromSelect("enemy");
    });

    randomBtn?.addEventListener("click", autoSelectVersus);
    inspectBtn?.addEventListener("click", () => {
        const id = playerSelect?.value || state.selectedLibraryCharacter;
        if (id) selectLibraryCharacter(id);
    });
    sheetBtn?.addEventListener("click", () => {
        const id = playerSelect?.value || state.selectedLibraryCharacter;
        if (id) openCharacterSheetModal(id);
    });

    autoSelectBtn?.addEventListener("click", () => {
        const chars = state.charactersData;
        if (chars.length === 0) return;
        const randomChar = chars[Math.floor(Math.random() * chars.length)];
        selectLibraryCharacter(randomChar.id);
        playerSelect.value = randomChar.id;
        document.getElementById("subclass-tab-btn")?.click();
        logCombat("Sistema", `Inspector auto-seleccionó: ${randomChar.nombre} (${randomChar.tipo})`);
    });
}
// Abre el modal de la Hoja de Personaje (Parchment Details Sheet)
function openCharacterSheetModal(id) {
    const char = state.loadedCharacters[id];
    if (!char) return;

    const selectedName = document.getElementById("selected-code-name");
    const selectedSignature = document.getElementById("selected-code-signature");
    if (selectedName) selectedName.textContent = `${char.constructor.name} extends Character`;
    if (selectedSignature) selectedSignature.textContent = `${char.id}.executeAction(index, target)`;
    
    document.getElementById("sheet-char-name").textContent = char.nombre;
    document.getElementById("sheet-char-portrait").src = getCharacterImageUrl(char, 'full_art');
    document.getElementById("sheet-char-title").textContent = char.titulo;
    document.getElementById("sheet-char-type").textContent = char.tipo;
    document.getElementById("sheet-char-element").textContent = `Elemento: ${char.elemento}`;
    document.getElementById("sheet-char-rarity").textContent = `Rareza: ${char.rareza}`;
    
    // Lore/Historia
    document.getElementById("sheet-char-lore").textContent = char.historia || char.lore || "No hay historia registrada.";
    
    // Estadísticas
    const statsContainer = document.getElementById("sheet-stats-container");
    statsContainer.innerHTML = "";
    
    const statLabels = {
        hp: "Salud Máxima",
        mana: "Maná Máximo",
        ataque: "Poder Físico",
        defensa: "Armadura",
        velocidad: "Agilidad",
        resistencia_magica: "Res. Mágica",
        critico: "Tasa Crítica"
    };
    
    for (let statKey in statLabels) {
        let val = char.stats[statKey];
        if (val === undefined) {
            if (statKey === "ataque") val = char.stats.attack;
            else if (statKey === "defensa") val = char.stats.defense;
            else if (statKey === "velocidad") val = char.stats.speed;
            else if (statKey === "critico") val = char.stats.critical;
            else if (statKey === "resistencia_magica") val = char.stats.magic_resistance;
        }
        if (val === undefined) val = 0;
        
        const statBox = document.createElement("div");
        statBox.className = "sheet-stat-box";
        statBox.innerHTML = `
            <div class="sheet-stat-label">${statLabels[statKey]}</div>
            <div class="sheet-stat-val">${val}</div>
        `;
        statsContainer.appendChild(statBox);
    }
    
    // Habilidades
    const abContainer = document.getElementById("sheet-abilities-container");
    abContainer.innerHTML = "";
    
    char.habilidades.forEach((ab, idx) => {
        const item = document.createElement("div");
        item.className = "sheet-ability-item";
        
        let dmg = ab.danio_base || ab.base_damage || 0;
        let cooldown = ab.cooldown || 0;
        
        item.innerHTML = `
            <div class="sheet-ability-name-row">
                <span>${idx + 1}. ${ab.nombre} (${ab.tipo || ab.type || 'Físico'})</span>
                <span>${dmg > 0 ? `Daño: ${dmg}` : ''} ${cooldown > 0 ? ` | CD: ${cooldown}t` : ''}</span>
            </div>
            <div class="sheet-ability-desc">${ab.descripcion || ab.description}</div>
        `;
        abContainer.appendChild(item);
    });
    
    // Fortalezas
    const strengthsUl = document.getElementById("sheet-char-strengths");
    strengthsUl.innerHTML = "";
    const strengths = char.fortalezas || char.strengths || [];
    strengths.forEach(str => {
        const li = document.createElement("li");
        li.textContent = str;
        strengthsUl.appendChild(li);
    });
    
    // Debilidades
    const weaknessesUl = document.getElementById("sheet-char-weaknesses");
    weaknessesUl.innerHTML = "";
    const weaknesses = char.debilidades || char.weaknesses || [];
    weaknesses.forEach(weak => {
        const li = document.createElement("li");
        li.textContent = weak;
        weaknessesUl.appendChild(li);
    });
    
    // Mostrar Modal
    document.getElementById("char-sheet-modal").classList.remove("hidden");
}

// Selecciona un personaje de la biblioteca para el panel Inspector OOP
function selectLibraryCharacter(id) {
    state.selectedLibraryCharacter = id;
    
    // Activar tarjeta visualmente
    document.querySelectorAll(".character-card").forEach(c => {
        c.classList.toggle("active", c.dataset.id === id);
    });
    
    const char = state.loadedCharacters[id];
    if (!char) return;
    
    // Actualizar pestaña de subclase
    const subclassTab = document.getElementById("subclass-tab-btn");
    subclassTab.textContent = `Subclase (${char.nombre})`;
    
    // Mostrar código fuente de la subclase
    const subclassCodeEl = document.getElementById("subclass-code");
    const rawCode = SUBCLASS_CODES[id] || `// No hay subclase personalizada definida para ${char.nombre}.\nHereda directamente todos los métodos de Character.`;
    subclassCodeEl.innerHTML = syntaxHighlight(rawCode);
    
    const subclassTitleEl = document.getElementById("inspector-subclass-title");
    subclassTitleEl.innerHTML = `<i class="fa-solid fa-project-diagram"></i> clase ${char.constructor.name} extiende Character`;
    
    // Activar pestaña subclase para que el usuario la vea de inmediato al hacer clic en el personaje
    switchTab("subclass");
}

// Helper para obtener colores RPG de HSL basados en elemento
function getElementColor(element) {
    const el = element.toLowerCase();
    if (el.includes("fuego") || el.includes("sangre")) return "#ff4757"; // rojo
    if (el.includes("tierra") || el.includes("metal")) return "#d4af37";  // oro/tierra
    if (el.includes("agua") || el.includes("hielo")) return "#1e90ff";    // azul
    if (el.includes("luz") || el.includes("sagrado")) return "#ffa502";   // dorado/sol
    if (el.includes("viento") || el.includes("naturaleza")) return "#2ed573"; // verde
    return "#a55eea"; // morado
}

// Helper para obtener URLs de imágenes de DevCop95 API de forma segura
function getCharacterImageUrl(char, pose = 'idle') {
    // Los nombres de propiedades de imágenes en la API están en español en 'imagenes' y en inglés en 'images'.
    // e.g. imagenes.idle, imagenes.full_art, imagenes.side_view, imagenes.back_view, imagenes.walk
    // Mapeo seguro:
    let imgPath = "";
    if (char.imagenes && char.imagenes[pose]) {
        imgPath = char.imagenes[pose];
    } else if (char.images && char.images[pose]) {
        imgPath = char.images[pose];
    } else if (char.imagenes && char.imagenes.idle) {
        imgPath = char.imagenes.idle;
    } else {
        // Fallback al repositorio directo
        // Estructura: img/Guerrero/guerrero_idle.png
        const folder = char.nombre;
        imgPath = `img/${folder}/${char.id}_${pose}.png`;
    }
    
    // Si la ruta ya es absoluta o completa en la API
    if (imgPath.startsWith("http")) return imgPath;
    
    // Si es relativa, anteponer base URL
    return `${API_BASE_URL}/${imgPath}`;
}


// --- LÓGICA DE LA ARENA Y COMBATE ---

function assignFighterFromSelect(team) {
    const selectId = team === "player" ? "player-select" : "enemy-select";
    const select = document.getElementById(selectId);
    const chosenId = select?.value || state.selectedLibraryCharacter;
    if (!chosenId) return;

    state.selectedLibraryCharacter = chosenId;
    assignFighter(team);
}

function autoSelectVersus() {
    if (state.battleActive || state.charactersData.length < 2) return;

    const firstIndex = Math.floor(Math.random() * state.charactersData.length);
    let secondIndex = Math.floor(Math.random() * state.charactersData.length);
    while (secondIndex === firstIndex) {
        secondIndex = Math.floor(Math.random() * state.charactersData.length);
    }

    const playerId = state.charactersData[firstIndex].id;
    const enemyId = state.charactersData[secondIndex].id;
    const playerSelect = document.getElementById("player-select");
    const enemySelect = document.getElementById("enemy-select");

    if (playerSelect) playerSelect.value = playerId;
    if (enemySelect) enemySelect.value = enemyId;

    state.selectedLibraryCharacter = playerId;
    assignFighter("player");
    state.selectedLibraryCharacter = enemyId;
    assignFighter("enemy");
    selectLibraryCharacter(playerId);

    logCombat("Sistema", "VS automático listo. Puedes iniciar la batalla o ajustar los selects.");
}

function assignFighter(team) {
    if (!state.selectedLibraryCharacter) {
        logCombat("Sistema", "Selecciona primero un personaje de la biblioteca.");
        return;
    }
    
    const charData = state.charactersData.find(c => c.id === state.selectedLibraryCharacter);
    
    // Crear una NUEVA instancia fresca para la batalla (usando Factory para el polimorfismo)
    const newFighterInstance = CharacterFactory.create(charData);
    
    state.fighters[team] = newFighterInstance;
    
    // Renderizar la ranura ocupada
    renderFighterSlot(team, newFighterInstance);
    
    logCombat("Sistema", `Se ha asignado a ${newFighterInstance.nombre} (${newFighterInstance.tipo}) al Equipo ${team === 'player' ? 'Héroe' : 'Adversario'}.`);
    
    // Validar si podemos iniciar batalla
    const btnStart = document.getElementById("btn-start-battle");
    if (state.fighters.player && state.fighters.enemy) {
        btnStart.removeAttribute("disabled");
    } else {
        btnStart.setAttribute("disabled", "true");
    }
}

function renderFighterSlot(team, fighter) {
    const slotContainer = document.getElementById(`${team}-slots`);
    slotContainer.innerHTML = "";
    
    if (!fighter) {
        // Renderizar ranura vacía
        const isPlayer = team === 'player';
        slotContainer.innerHTML = `
            <div class="empty-slot" data-team="${team}" id="slot-${team}-empty">
                <i class="fa-solid ${isPlayer ? 'fa-shield-halved' : 'fa-skull'}"></i>
                <p>Ranura ${isPlayer ? 'Héroe' : 'Adversario'}</p>
            </div>
        `;
        // Volver a enlazar evento
        document.getElementById(`slot-${team}-empty`).addEventListener("click", () => {
            assignFighter(team);
        });
        return;
    }
    
    const card = document.createElement("div");
    card.className = "combatant-card";
    card.id = `combatant-${team}`;
    if (fighter.hp <= 0) card.classList.add("dead");
    
    // Botón para vaciar ranura (desactivado si hay batalla activa)
    const removeBtn = state.battleActive ? "" : `
        <button class="btn-remove-slot" onclick="event.stopPropagation(); removeFighter('${team}')" title="Quitar combatiente">
            &times;
        </button>
    `;
    
    // Obtener imagen del pose activo (cuando HP <= 0, se usa la imagen 6, e.g. 'walk'; de lo contrario, 'full_art')
    let pose = 'full_art';
    if (fighter.hp <= 0) {
        const keys = Object.keys(fighter.imagenes || {});
        if (keys.length >= 6) {
            pose = keys[5];
        } else {
            pose = 'walk';
        }
    }
    const avatarUrl = getCharacterImageUrl(fighter, pose);
    
    // Renderizar barras y medallas de estado
    let effectsHtml = "";
    for (let effect in fighter.statusEffects) {
        let icon = "fa-star";
        if (effect === "shield") icon = "fa-shield-halved";
        if (effect === "taunt") icon = "fa-crosshairs";
        if (effect === "fury") icon = "fa-fire";
        effectsHtml += `<span class="effect-badge effect-${effect}"><i class="fa-solid ${icon}"></i> ${effect.toUpperCase()}</span>`;
    }
    
    card.innerHTML = `
        ${removeBtn}
        <div class="combatant-main-info">
            <div class="combatant-avatar-wrapper">
                <img class="combatant-avatar" src="${avatarUrl}" id="avatar-${team}" alt="${fighter.nombre}">
            </div>
            <div class="combatant-text-info">
                <span class="combatant-name">${fighter.nombre}</span>
                <span class="combatant-class">${fighter.tipo}</span>
            </div>
        </div>
        <div class="combatant-stats-container">
            <!-- HP Bar -->
            <div class="bar-container" title="Salud">
                <div class="bar-fill bar-hp" style="width: ${fighter.getHpPercentage()}%"></div>
                <div class="bar-values">${fighter.hp} / ${fighter.maxHp} HP</div>
            </div>
            
            <!-- Mana Bar -->
            <div class="bar-container" title="Maná">
                <div class="bar-fill bar-mana" style="width: ${fighter.getManaPercentage()}%"></div>
                <div class="bar-values">${fighter.mana} / ${fighter.maxMana} MP</div>
            </div>
            
            <!-- Shield Points (si hay) -->
            ${fighter.shieldPoints > 0 ? `
            <div class="bar-container" title="Escudo de Absorción">
                <div class="bar-fill bar-shield" style="width: 100%"></div>
                <div class="bar-values">${fighter.shieldPoints} Escudo</div>
            </div>` : ""}

            <div class="effects-row">
                ${effectsHtml}
            </div>
        </div>
    `;
    
    slotContainer.appendChild(card);
    
    // Aplicar flash visual si corresponde
    if (fighter.flashType) {
        applyVisualFlash(team, fighter.flashType);
        fighter.flashType = null; // Limpiar
    }
}

// Eliminar combatiente de una ranura
window.removeFighter = function(team) {
    if (state.battleActive) return;
    state.fighters[team] = null;
    renderFighterSlot(team, null);
    
    // Deshabilitar botón batalla
    document.getElementById("btn-start-battle").setAttribute("disabled", "true");
    logCombat("Sistema", `Se retiró el combatiente de la ranura ${team === 'player' ? 'Héroe' : 'Adversario'}.`);
};

// Aplica sacudidas o luces de daño/curación
function applyVisualFlash(team, type) {
    const el = document.getElementById(`combatant-${team}`);
    if (!el) return;
    
    const flashClass = `${type}-flash`;
    el.classList.add(flashClass);
    if (type === "damage") {
        el.classList.add("shake-animation");
    }
    
    setTimeout(() => {
        el.classList.remove(flashClass);
        el.classList.remove("shake-animation");
    }, 400);
}

// Mostrar popup de daño flotante sobre el personaje
function spawnFloatingText(team, text, type) {
    const slot = document.getElementById(`combatant-${team}`);
    if (!slot) return;
    
    const popup = document.createElement("div");
    popup.className = `floating-text float-${type}`;
    popup.textContent = text;
    
    // Posicionamiento
    const rect = slot.getBoundingClientRect();
    popup.style.left = `50%`;
    popup.style.top = `20%`;
    
    slot.appendChild(popup);
    
    setTimeout(() => {
        popup.remove();
    }, 800);
}


// --- MOTOR DE COMBATE POR TURNOS ---

function startBattle() {
    if (!state.fighters.player || !state.fighters.enemy) return;
    
    state.battleActive = true;
    state.turnNumber = 1;
    
    // Deshabilitar botones de configurar arena
    document.getElementById("btn-add-player").setAttribute("disabled", "true");
    document.getElementById("btn-add-enemy").setAttribute("disabled", "true");
    document.getElementById("btn-start-battle").classList.add("hidden");
    document.getElementById("btn-reset-battle").classList.remove("hidden");
    
    // Quitar botones de cierre de las ranuras
    renderFighterSlot("player", state.fighters.player);
    renderFighterSlot("enemy", state.fighters.enemy);
    
    logCombat("Sistema", `¡Comienza la batalla entre ${state.fighters.player.nombre} y ${state.fighters.enemy.nombre}!`);
    
    // Decidir quién va primero según velocidad (Polimorfismo implícito al leer .stats.speed)
    const playerSpeed = state.fighters.player.stats.speed || 50;
    const enemySpeed = state.fighters.enemy.stats.speed || 50;
    
    if (playerSpeed >= enemySpeed) {
        state.currentTurn = "player";
        logCombat("Sistema", `Inicia el Equipo Héroe por mayor velocidad (${playerSpeed} vs ${enemySpeed}).`);
    } else {
        state.currentTurn = "enemy";
        logCombat("Sistema", `Inicia el Equipo Adversario por mayor velocidad (${enemySpeed} vs ${playerSpeed}).`);
    }
    
    setupTurn();
}

function setupTurn() {
    if (!state.battleActive) return;
    
    // Verificar si hay ganador primero
    if (checkBattleEnd()) return;
    
    const activeFighter = state.fighters[state.currentTurn];
    const opponentFighter = state.fighters[state.currentTurn === 'player' ? 'enemy' : 'player'];
    
    // Actualizar badges visuales
    document.getElementById("current-turn-badge").textContent = `Turno de: ${activeFighter.nombre}`;
    
    // Resaltar activamente la carta
    document.getElementById("combatant-player").classList.toggle("active-turn", state.currentTurn === 'player');
    document.getElementById("combatant-enemy").classList.toggle("active-turn", state.currentTurn === 'enemy');
    
    // Decrementar turnos de buffs/debuffs del personaje al iniciar su turno
    activeFighter.decrementStatuses();
    
    // Renderizar para actualizar badges de estados
    renderFighterSlot("player", state.fighters.player);
    renderFighterSlot("enemy", state.fighters.enemy);
    
    if (state.currentTurn === "player") {
        // Habilitar panel de acciones para el jugador
        enableActionsPanel(activeFighter);
    } else {
        // Deshabilitar panel de acciones y ejecutar IA enemiga tras breve retraso dramático
        disableActionsPanel();
        setTimeout(() => {
            executeEnemyAI(activeFighter, opponentFighter);
        }, 1500);
    }
}

function enableActionsPanel(fighter) {
    const container = document.getElementById("battle-actions-container");
    container.classList.remove("disabled");
    
    // Avatar e info
    const avatarWrapper = document.getElementById("active-char-avatar-wrapper");
    const avatar = document.getElementById("active-char-avatar");
    avatar.src = getCharacterImageUrl(fighter, 'idle_small');
    avatarWrapper.classList.remove("hidden");
    
    document.getElementById("active-char-name").textContent = fighter.nombre;
    document.getElementById("active-char-type").textContent = `Tipo: ${fighter.tipo} (Elige Habilidad)`;
    
    // Botones de habilidades
    const abGrid = document.getElementById("abilities-container");
    abGrid.innerHTML = "";
    
    fighter.habilidades.forEach((ab, idx) => {
        const btn = document.createElement("button");
        btn.className = "ability-btn";
        
        // Calcular costo de maná aproximado para la UI
        let manaCost = 0;
        if (fighter instanceof Mage && idx > 0) manaCost = idx === 1 ? 25 : 40;
        if (fighter instanceof Cleric && idx > 0) manaCost = idx === 1 ? 20 : 35;
        if (fighter instanceof Healer && idx > 0) manaCost = 25;
        
        btn.innerHTML = `
            <div class="ability-title">
                <span>${ab.nombre}</span>
                ${manaCost > 0 ? `<span class="ability-cost">${manaCost} MP</span>` : ""}
            </div>
            <div class="ability-desc">${ab.descripcion}</div>
        `;
        
        // Validar si el jugador tiene suficiente maná
        if (manaCost > 0 && fighter.mana < manaCost) {
            btn.setAttribute("disabled", "true");
            btn.title = "Maná insuficiente";
        }
        
        btn.addEventListener("click", () => {
            executePlayerTurn(idx);
        });
        
        abGrid.appendChild(btn);
    });
}

function disableActionsPanel() {
    const container = document.getElementById("battle-actions-container");
    container.classList.add("disabled");
    
    document.getElementById("active-char-avatar-wrapper").classList.add("hidden");
    document.getElementById("active-char-name").textContent = "Turno del Oponente...";
    document.getElementById("active-char-type").textContent = "Calculando movimiento polimórfico...";
    document.getElementById("abilities-container").innerHTML = "";
}

// Genera una explicación didáctica en tiempo real del polimorfismo que acaba de ocurrir
function updateLivePolymorphismText(fighter, abilityIndex, result) {
    const className = fighter.constructor.name;
    const container = document.getElementById("live-poly-container");
    const textBox = document.getElementById("live-poly-explanation-text");
    
    let explanation = `
        <p><strong>Clase del Personaje:</strong> <code>${className}</code> (extiende de <code>Character</code>)</p>
        <p><strong>Llamada común en el motor:</strong> <code>personajeActivo.executeAction(${abilityIndex}, objetivo)</code></p>
    `;
    
    let specificInfo = "";
    
    if (fighter instanceof Warrior) {
        if (abilityIndex === 1) {
            specificInfo = "El <strong>Guerrero</strong> activa su escudo. El método sobrescrito <code>executeAction()</code> intercepta el flujo estándar para establecer <code>this.shieldActive = true</code>, lo que provocará que la llamada polimórfica a <code>takeDamage()</code> en los próximos turnos reduzca el daño un 60% en lugar del comportamiento de reducción estándar de la clase base.";
        } else if (abilityIndex === 2) {
            specificInfo = "El <strong>Guerrero</strong> usa Provocar. Su método sobrescrito aplica el estado de <code>taunt</code> al enemigo, forzándolo a atacarle directamente.";
        } else {
            specificInfo = "El <strong>Guerrero</strong> ejecuta un ataque regular. Esto cancela la guardia del escudo activo (<code>this.shieldActive = false</code>) y realiza un golpe estándar.";
        }
    } else if (fighter instanceof Berserker) {
        specificInfo = "El <strong>Berserker</strong> sobrescribe el cálculo de daño. A medida que su HP desciende, el multiplicador <code>this.furyMultiplier</code> aumenta hasta 2.0. Al invocar <code>executeAction()</code>, aplica este factor de Furia. Su HP costó <code>${result.selfDamage || 0}</code> en esta habilidad, lo que incrementa dinámicamente su Furia.";
    } else if (fighter instanceof Mage) {
        if (abilityIndex > 0) {
            specificInfo = "El <strong>Mago</strong> ejecuta un hechizo de maná. Su método sobrescrito valida si <code>this.mana</code> es suficiente, restando el coste e invocando <code>target.takeDamage(daño, 'magic')</code>. El daño mágico ignora la defensa física estándar de la armadura y mitiga según la resistencia mágica del objetivo.";
        } else {
            specificInfo = "El <strong>Mago</strong> usa su ataque básico. Recupera 15 puntos de maná adicionales como parte de su comportamiento de clase sobrescrito.";
        }
    } else if (fighter instanceof Cleric) {
        if (abilityIndex === 1) {
            specificInfo = "El <strong>Clérigo</strong> sobrescribe <code>executeAction()</code> para redirigir la acción hacia aliados. Al curar, la vida aumenta (<code>ally.hp = Math.min(...)</code>) en lugar de restar daño, demostrando cómo una acción polimórfica puede cambiar por completo el propósito del método.";
        } else if (abilityIndex === 2) {
            specificInfo = "El <strong>Clérigo</strong> utiliza Escudo de Luz. Crea puntos de absorción temporal (<code>ally.shieldPoints</code>) que mitigan el daño antes de que afecte a la salud en <code>takeDamage()</code>.";
        } else {
            specificInfo = "El <strong>Clérigo</strong> realiza un ataque básico de daño físico estándar.";
        }
    } else if (fighter instanceof Healer) {
        if (abilityIndex > 0) {
            specificInfo = "La <strong>Curandera</strong> sobrescribe <code>executeAction()</code> para sanar salud. Posee una pasiva especial de clase: si el aliado tiene salud menor al 35%, la curación incrementa un 50% extra (<code>healPower * 1.5</code>) en lugar del valor plano.";
        } else {
            specificInfo = "La <strong>Curandera</strong> ejecuta un ataque básico estándar.";
        }
    } else if (fighter instanceof Ninja) {
        if (abilityIndex === 1) {
            specificInfo = "El <strong>Ninja</strong> ejecuta un ataque doble. Su método sobrescrito invoca <code>target.takeDamage()</code> dos veces consecutivas en la misma acción.";
        } else if (abilityIndex === 2) {
            specificInfo = "El <strong>Ninja</strong> ejecuta un golpe crítico. Tiene una probabilidad crítica incrementada (60%), lo que duplica el daño final si se activa.";
        } else {
            specificInfo = "El <strong>Ninja</strong> realiza un corte estándar. Adicionalmente, el Ninja sobrescribe el método <code>takeDamage()</code> de la clase base, otorgándole una probabilidad pasiva constante de esquivar por completo ataques físicos basada en su agilidad.";
        }
    } else if (fighter instanceof Templar) {
        if (abilityIndex === 2) {
            specificInfo = "El <strong>Templario</strong> sobrescribe <code>executeAction()</code> para invocar una barrera sagrada de absorción (<code>this.lightBarrier</code>). Su método sobrescrito de daño también refleja automáticamente el 20% de cualquier daño recibido de vuelta al atacante.";
        } else if (abilityIndex === 1) {
            specificInfo = "El <strong>Templario</strong> usa Golpe Sagrado. Inflige daño físico y sana su propia vida un 45% del daño base gracias a su aura bendita.";
        } else {
            specificInfo = "El <strong>Templario</strong> ataca con su mazo físico regular.";
        }
    } else {
        specificInfo = "Se ejecuta el método de acción predeterminado de la clase base <code>Character</code>.";
    }
    
    explanation += `<div class="live-poly-explanation-box-content" style="border-top: 1px solid rgba(92, 77, 55, 0.15); padding-top: 0.5rem; margin-top: 0.5rem;">
        <strong>Efecto del Polimorfismo:</strong> ${specificInfo}
    </div>`;
    
    textBox.innerHTML = explanation;
}

// Turno del Jugador al pulsar una habilidad
function executePlayerTurn(abilityIndex) {
    const player = state.fighters.player;
    const enemy = state.fighters.enemy;
    
    const result = player.executeAction(abilityIndex, enemy, [player], [enemy]);
    
    logPolymorphismLog(player, abilityIndex, result);
    updateLivePolymorphismText(player, abilityIndex, result);
    processActionResult("enemy", "player", result);
    
    selectLibraryCharacter(player.id);
    switchTab("subclass");
    
    state.currentTurn = "enemy";
    state.turnNumber++;
    
    setTimeout(setupTurn, 1000);
}

// Turno de la IA Enemiga
function executeEnemyAI(enemy, player) {
    let abilityIndex = 0;
    
    if ((enemy instanceof Healer || enemy instanceof Cleric) && enemy.hp < enemy.maxHp * 0.5 && enemy.mana >= 25) {
        abilityIndex = 1;
    } else {
        const possibleIndices = [0, 1, 2];
        const validIndices = possibleIndices.filter(idx => {
            let cost = 0;
            if (enemy instanceof Mage && idx > 0) cost = idx === 1 ? 25 : 40;
            if (enemy instanceof Cleric && idx > 0) cost = idx === 1 ? 20 : 35;
            if (enemy instanceof Healer && idx > 0) cost = 25;
            return enemy.mana >= cost;
        });
        
        abilityIndex = validIndices.length > 0 ? validIndices[Math.floor(Math.random() * validIndices.length)] : 0;
    }
    
    const result = enemy.executeAction(abilityIndex, player, [enemy], [player]);
    
    logPolymorphismLog(enemy, abilityIndex, result);
    updateLivePolymorphismText(enemy, abilityIndex, result);
    processActionResult("player", "enemy", result);
    
    selectLibraryCharacter(enemy.id);
    switchTab("subclass");
    
    state.currentTurn = "player";
    state.turnNumber++;
    
    setTimeout(setupTurn, 1000);
}

function processActionResult(targetTeam, sourceTeam, result) {
    const target = state.fighters[targetTeam];
    const source = state.fighters[sourceTeam];
    
    if (result.type === "fail") {
        logCombat("Sistema", result.text);
        spawnFloatingText(sourceTeam, "Fallo", "miss");
        return;
    }
    
    logCombat("Arena", result.text);
    
    // Daño aplicado al objetivo
    if (result.damage !== undefined && result.damage > 0) {
        spawnFloatingText(targetTeam, `-${result.damage}`, "damage");
    }
    
    // Daño propio del Berserker
    if (result.selfDamage !== undefined && result.selfDamage > 0) {
        spawnFloatingText(sourceTeam, `-${result.selfDamage}`, "damage");
    }
    
    // Curación
    if (result.heal !== undefined && result.heal > 0) {
        // El Templar se cura a sí mismo, Healer cura a sí mismo o aliado
        // En 1v1 Healer cura a sí mismo, por lo que sourceTeam o targetTeam
        const healedTeam = (result.abilityName === "Golpe Sagrado") ? sourceTeam : sourceTeam; 
        spawnFloatingText(healedTeam, `+${result.heal}`, "heal");
    }
    
    // Escudo generado
    if (result.shield !== undefined && result.shield > 0) {
        spawnFloatingText(sourceTeam, `+${result.shield} Escudo`, "shield");
    }
    
    // Si el objetivo tiene alguna pasiva de reflejo (ej. Templario) y reflejó daño
    // Eso ocurre durante target.takeDamage(), que internamente ataca al source
    // Verificamos si la vida del source disminuyó
    
    // Re-renderizar ambas ranuras para mostrar barras de salud y maná animadas
    renderFighterSlot("player", state.fighters.player);
    renderFighterSlot("enemy", state.fighters.enemy);
}

function checkBattleEnd() {
    const player = state.fighters.player;
    const enemy = state.fighters.enemy;
    
    if (player.hp <= 0 && enemy.hp <= 0) {
        logCombat("Arena", "¡Doble K.O.! Ambos héroes han caído en combate.");
        endBattle("empate");
        return true;
    }
    
    if (player.hp <= 0) {
        logCombat("Arena", `K.O. - ${player.nombre} ha caído. ¡Gana el Equipo Adversario!`);
        endBattle("enemy");
        return true;
    }
    
    if (enemy.hp <= 0) {
        logCombat("Arena", `Victoria - ${enemy.nombre} ha sido derrotado. ¡Gana el Equipo Héroe!`);
        endBattle("player");
        return true;
    }
    
    return false;
}

function endBattle(winner) {
    state.battleActive = false;
    
    document.getElementById("current-turn-badge").textContent = winner === "empate" ? "¡Doble K.O!" : `Ganador: ${state.fighters[winner].nombre}`;
    
    // Mostrar ranuras con estado final K.O.
    renderFighterSlot("player", state.fighters.player);
    renderFighterSlot("enemy", state.fighters.enemy);
    
    logCombat("Sistema", "La batalla ha concluido. Presiona 'Reiniciar' para volver a armar tu equipo.");
}

function resetBattle() {
    state.battleActive = false;
    
    // Revivir personajes en los slots de arena con HP lleno
    if (state.fighters.player) {
        const pData = state.charactersData.find(c => c.id === state.fighters.player.id);
        state.fighters.player = CharacterFactory.create(pData);
        renderFighterSlot("player", state.fighters.player);
    }
    
    if (state.fighters.enemy) {
        const eData = state.charactersData.find(c => c.id === state.fighters.enemy.id);
        state.fighters.enemy = CharacterFactory.create(eData);
        renderFighterSlot("enemy", state.fighters.enemy);
    }
    
    // Habilitar edición de arena
    document.getElementById("btn-add-player").removeAttribute("disabled");
    document.getElementById("btn-add-enemy").removeAttribute("disabled");
    document.getElementById("btn-start-battle").classList.remove("hidden");
    document.getElementById("btn-reset-battle").classList.add("hidden");
    
    document.getElementById("current-turn-badge").textContent = "Listo para pelear";
    disableActionsPanel();
    
    logCombat("Sistema", "Arena reiniciada. Los combatientes han recuperado toda su salud y maná.");
}


// --- SISTEMA DE LOGS Y CONSOLA DE COMBATE ---

function logCombat(type, message) {
    const logContainer = document.getElementById("combat-log");
    
    const entry = document.createElement("div");
    entry.className = `log-entry ${type.toLowerCase()}-entry`;
    
    // Timestamp simple
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    entry.innerHTML = `<span style="color: #6272a4">[${timeStr}]</span> <strong>${type}:</strong> ${message}`;
    
    logContainer.appendChild(entry);
    
    // Auto scroll al final
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Log especial que explica el enlace dinámico y el polimorfismo
function logPolymorphismLog(fighter, abilityIdx, result) {
    const ability = fighter.habilidades[abilityIdx];
    const className = fighter.constructor.name;
    
    const explanation = `Llamada polimórfica: <code>${fighter.id}.executeAction(${abilityIdx})</code> resolvió en <strong><code>${className}.executeAction()</code></strong>.`;
    
    logCombat("Polimorfismo", explanation);
}


// --- PESTAÑAS (TABS) E INTERACCIONES ---

function switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    
    document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.toggle("hidden", content.id !== `tab-${tabId}`);
    });
}

// Resaltador de sintaxis RegExp para JavaScript en el Inspector (Sin bugs de doble reemplazo)
function syntaxHighlight(code) {
    // 1. Escapar caracteres HTML
    let escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. Extraer comentarios y strings para aislarlos del formateador
    const placeholders = [];
    let placeholderId = 0;

    function savePlaceholder(text, type) {
        const id = `___PLACEHOLDER_${type}_${placeholderId++}___`;
        placeholders.push({ id, text });
        return id;
    }

    // Comentarios multilinea
    escaped = escaped.replace(/\/\*[\s\S]*?\*\//g, (match) => {
        return savePlaceholder(`<span class="code-comment">${match}</span>`, "comment");
    });
    
    // Comentarios de una linea
    escaped = escaped.replace(/\/\/.*/g, (match) => {
        return savePlaceholder(`<span class="code-comment">${match}</span>`, "comment");
    });

    // Strings
    escaped = escaped.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, (match) => {
        return savePlaceholder(`<span class="code-string">${match}</span>`, "string");
    });

    // 3. Resaltar palabras clave de JavaScript
    const keywords = /\b(class|extends|constructor|super|this|return|let|const|var|if|else|for|while|new|switch|case|break|default)\b/g;
    escaped = escaped.replace(keywords, '<span class="code-keyword">$1</span>');

    // Clases
    const classes = /\b(Character|Warrior|Berserker|Mage|Cleric|Healer|Ninja|Templar)\b/g;
    escaped = escaped.replace(classes, '<span class="code-class">$1</span>');

    // Métodos/Funciones
    const functions = /\b(takeDamage|executeAction|useAbility|applyStatus|getHpPercentage|getManaPercentage|Math\.max|Math\.min|Math\.round|Math\.random|CharacterFactory\.create|decrementStatuses|hasStatus)\b/g;
    escaped = escaped.replace(functions, '<span class="code-function">$1</span>');

    // Números
    escaped = escaped.replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');

    // 4. Restaurar comentarios y strings en orden inverso
    for (let i = placeholders.length - 1; i >= 0; i--) {
        escaped = escaped.replace(placeholders[i].id, placeholders[i].text);
    }

    return escaped;
}


// --- INICIALIZACIÓN DE LA APLICACIÓN ---

document.addEventListener("DOMContentLoaded", () => {
    // Eventos de botones
    document.getElementById("btn-add-player").addEventListener("click", () => assignFighterFromSelect("player"));
    document.getElementById("btn-add-enemy").addEventListener("click", () => assignFighterFromSelect("enemy"));
    document.getElementById("btn-start-battle").addEventListener("click", startBattle);
    document.getElementById("btn-reset-battle").addEventListener("click", resetBattle);
    document.getElementById("btn-clear-log").addEventListener("click", () => {
        document.getElementById("combat-log").innerHTML = "";
        logCombat("Sistema", "Consola vaciada.");
    });
    
    // Modal Informativo
    const modal = document.getElementById("info-modal");
    document.getElementById("info-badge").addEventListener("click", () => {
        modal.classList.remove("hidden");
    });
    document.getElementById("btn-close-modal").addEventListener("click", () => {
        modal.classList.add("hidden");
    });
    
    // Modal Hoja de Personaje
    const sheetModal = document.getElementById("char-sheet-modal");
    document.getElementById("btn-close-sheet").addEventListener("click", () => {
        sheetModal.classList.add("hidden");
    });
    
    // Modal Ayuda API
    const apiHelpModal = document.getElementById("api-help-modal");
    document.getElementById("btn-close-api-help").addEventListener("click", () => {
        apiHelpModal.classList.add("hidden");
    });
    
    // Modal de Bienvenida (Welcome Modal)
    const welcomeModal = document.getElementById("welcome-modal");
    const closeWelcome = () => {
        welcomeModal.classList.add("hidden");
    };
    document.getElementById("btn-close-welcome")?.addEventListener("click", closeWelcome);
    document.getElementById("btn-enter-arena")?.addEventListener("click", closeWelcome);
    
    // Cerrar modals al clickear fuera
    window.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.add("hidden");
        }
        if (e.target === sheetModal) {
            sheetModal.classList.add("hidden");
        }
        if (e.target === apiHelpModal) {
            apiHelpModal.classList.add("hidden");
        }
        if (e.target === welcomeModal) {
            welcomeModal.classList.add("hidden");
        }
    });
    
    // Abrir Modal Ayuda API mediante delegación de eventos
    document.addEventListener("click", (e) => {
        const helpBtn = e.target.closest("#btn-api-help");
        if (helpBtn) {
            document.getElementById("api-help-modal").classList.remove("hidden");
        }
    });
    
    // Control de Pestañas
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchTab(btn.dataset.tab);
        });
    });
    
    // Iniciar carga de la API
    fetchCharacters();
});

