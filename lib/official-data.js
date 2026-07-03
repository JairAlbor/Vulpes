'use strict';

const fs   = require('fs');
const path = require('path');

const OFFICIAL_FILE = path.join(__dirname, '..', 'data', 'official.json');

let cached = null;

function loadOfficialData() {
    if (cached) return cached;
    try {
        cached = JSON.parse(fs.readFileSync(OFFICIAL_FILE, 'utf8'));
    } catch (e) {
        console.error('Error loading data/official.json:', e.message);
        cached = {};
    }
    return cached;
}

function getStaticCacheFields() {
    const data = loadOfficialData();
    return {
        contacto:  data.contacto  || {},
        horarios:  data.horarios  || {},
        official:  data
    };
}

function buildBaseInstruction() {
    const d = loadOfficialData();
    const inst  = d.institution     || {};
    const conv  = d.convocatoria2026 || {};
    const plan  = d.planEstudios    || {};
    const svc   = d.servicios       || {};
    const cont  = d.contacto        || {};
    const hor   = d.horarios        || {};
    const hist  = d.historia        || [];
    const meta  = d.meta            || {};

    const requisitos = (conv.requisitos || []).map(r => '- ' + r).join('\n');
    const areas      = (plan.areasPropedeuticas || []).join(', ');
    const historia   = hist.map(h => '- ' + h).join('\n');

    return `
Eres el "Asistente Nicolaita", un asesor virtual inteligente para el prestigioso e histórico "${inst.name || 'Colegio Primitivo y Nacional de San Nicolás de Hidalgo'}", perteneciente a la ${inst.university || 'UMSNH'}.
Tu objetivo es responder de manera amable, atenta y precisa las preguntas de los aspirantes, alumnos y padres de familia, basándote en los datos oficiales de la institución y en el índice actualizado del sitio web que se adjunta más abajo.
Datos verificados manualmente: ${meta.lastVerified || 'desconocida'}. Si hay conflicto con una página del sitio, prioriza la información más reciente del aviso oficial.

1. HISTORIA E IDENTIDAD:
${historia}
- El lema del colegio es '${inst.motto || 'Patria, Ciencia y Libertad'}'.
- Autoridades: Rectora de la UMSNH: ${inst.rectora || 'consultar sitio oficial'}. Regente del Colegio: ${inst.regente || 'consultar sitio oficial'}.

2. CONVOCATORIA DE ADMISIÓN NUEVO INGRESO ${conv.ciclo || '2026/2027'} (${conv.nivel || 'BACHILLERATO'}):
- Registro en línea: exclusivamente en ${conv.registroUrl || 'www.umich.mx'}. ${conv.registroNota || ''}
- Inicio de registro: ${conv.registroInicio || 'consultar avisos oficiales'}.
- Plazo de registro hasta: ${conv.registroFin || 'consultar avisos oficiales'}.
- Exámenes de ingreso: ${conv.examenes || 'consultar avisos oficiales'}.
- Publicación de resultados: ${conv.resultados || 'consultar avisos oficiales'}.
- Inicio de clases: ${conv.inicioClases || 'consultar avisos oficiales'}.
- Costo de la ficha de examen: ${conv.costoFicha || 'consultar avisos oficiales'}. ${conv.costoNota || ''}
- Requisitos:
${requisitos}
- Asignación de preparatoria: ${conv.asignacionPreparatoria || 'consultar avisos oficiales'}.

3. PLAN DE ESTUDIOS (BACHILLERATO NICOLAITA):
- ${plan.sistema || 'Sistema semestral, 3 años.'}
- Tronco Común: ${plan.troncoComun || '1er a 4to semestre.'}
- Áreas Propedéuticas (${plan.areasSemestres || '5to y 6to semestre'}): ${areas}.

4. TRÁMITES Y SERVICIOS:
- Seguro Facultativo IMSS: ${svc.seguroFacultativo || 'consultar sitio oficial.'}
- Justificantes: ${svc.justificantes || 'Secretaría Académica.'}
- Sistema de Alerta Temprana: ${svc.alertaTemprana || ''}
- SIIA (calificaciones y órdenes de pago): ${svc.siia || 'www.siia.umich.mx'}
- Correo Institucional: cuenta Gmail proporcionada a los estudiantes para sus clases.
- Beca Benito Juárez: ${svc.becaBenitoJuarez || 'consultar gob.mx'}

5. PORTAL DE HORARIOS DE CLASE Y MANUALES:
- Portal Principal: ${hor.portal || ''}
- Semestre NON (1er, 3er y 5to): ${hor.semestresNon || ''}
- Semestre PAR (2do, 4to y 6to): ${hor.semestresPar || ''}
- Trayectorias 3er Semestre NON: ${hor.trayectorias3non || ''}
- Trayectorias 5to Semestre NON: ${hor.trayectorias5non || ''}
- Trayectorias PAR (4to y 6to): ${hor.trayectoriasPar || ''}
- Manuales de Laboratorio: en la página de Semestre NON (botones verdes para PDF).

INSTRUCCIONES PARA HORARIOS:
1. NUNCA proporciones enlaces directos a archivos PDF (que terminen en .pdf). Siempre da la página donde está el botón.
2. Sección con centenas impares (101, 301, 501...): Semestre NON → ${hor.semestresNon || ''}
3. Sección con centenas pares (201, 401, 601...): Semestre PAR → ${hor.semestresPar || ''}
4. Trayectorias 3er semestre → ${hor.trayectorias3non || ''}
5. Trayectorias 5to semestre → ${hor.trayectorias5non || ''}
6. NUNCA uses el formato Markdown '[texto](url)'. Escribe siempre las URLs completas directamente en el texto.

6. DATOS DE CONTACTO:
- Dirección: ${cont.direccion || ''}
- Horario: Matutino ${cont.horarioMatutino || ''} | Vespertino ${cont.horarioVespertino || ''}
- Correo Académico: ${cont.correo || ''}
- CCT: ${inst.cct || ''}
${cont.telefonos ? '- Teléfonos: ' + cont.telefonos.join(', ') + ' (' + (cont.telefonoHorario || '') + ').' : ''}

LINEAMIENTOS DE PERSONALIDAD:
- Sé amable, educado y usa un tono entusiasta que demuestre orgullo Nicolaita.
- Solo responde preguntas sobre el Colegio de San Nicolás y el sitio web oficial. Si te preguntan cosas no relacionadas, redirige cordialmente al tema escolar.
- Usa párrafos breves, viñetas y negritas para facilitar la lectura en pantallas pequeñas.
- Si el usuario pregunta sobre algo que está en el índice del sitio web (sección 7 más abajo), proporciona la URL directamente para que pueda acceder a la información.
`.trim();
}

function normalizarTexto(texto) {
    return (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function buscarPaginasRelevantes(query, urlsSitio, topN) {
    topN = topN || 5;
    const queryNormalizada = normalizarTexto(query);
    const palabras = queryNormalizada.split(/\s+/).filter(w => w.trim().length > 1);
    if (palabras.length === 0) return urlsSitio.slice(0, topN);

    return urlsSitio
        .map(p => {
            const texto = normalizarTexto((p.titulo || '') + ' ' + (p.contenido || ''));
            const score = palabras.filter(w => texto.includes(w)).length;
            return Object.assign({}, p, { score: score });
        })
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
}

function buscarPdfsRelevantes(query, pdfIndex, topN) {
    topN = topN || 4;
    if (!pdfIndex || pdfIndex.length === 0) return [];
    const queryNormalizada = normalizarTexto(query);
    const palabras = queryNormalizada.split(/\s+/).filter(w => w.trim().length > 1);
    if (palabras.length === 0) return [];

    return pdfIndex
        .map(p => {
            const texto = normalizarTexto((p.titulo || '') + ' ' + (p.url || ''));
            const score = palabras.filter(w => texto.includes(w)).length;
            return Object.assign({}, p, { score: score });
        })
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
}

function buildSystemInstruction(queryText, contextoCache) {
    const base = buildBaseInstruction();

    if (!contextoCache || !contextoCache.urlsSitio || contextoCache.urlsSitio.length === 0) {
        return base;
    }

    const fecha = contextoCache.ultimaActualizacion
        ? new Date(contextoCache.ultimaActualizacion).toLocaleDateString('es-MX')
        : 'desconocida';

    let extra = '\n\n7. ÍNDICE ACTUALIZADO DEL SITIO OFICIAL (actualización: ' + fecha + ')\n\n';
    extra += 'Utiliza el siguiente índice para responder preguntas específicas sobre cualquier sección del sitio web del colegio:\n\n';

    let paginas = queryText
        ? buscarPaginasRelevantes(queryText, contextoCache.urlsSitio, 5)
        : [];
    if (paginas.length === 0) {
        paginas = contextoCache.urlsSitio.slice(0, 5);
    }

    for (let i = 0; i < paginas.length; i++) {
        const p = paginas[i];
        if (!p.titulo && !p.descripcion && !p.contenido) continue;
        extra += '### ' + (p.titulo || 'Página del Colegio') + '\n';
        extra += 'URL: ' + p.url + '\n';
        if (p.descripcion) extra += 'Descripción: ' + p.descripcion + '\n';
        if (p.contenido)   extra += 'Contenido: '   + p.contenido.slice(0, 400) + '\n';
        extra += '\n';
    }

    let pdfs = queryText
        ? buscarPdfsRelevantes(queryText, contextoCache.pdfIndex, 4)
        : [];

    if (pdfs.length > 0) {
        extra += '\nDOCUMENTOS PDF RELACIONADOS:\n';
        extra += 'Si el usuario pregunta por alguno de estos documentos, infórmale en qué página del sitio web se encuentra (URL de la página que lo enlaza) para que pueda acceder a él. NUNCA proporciones enlaces directos que terminen en .pdf a menos que el usuario lo pida explícitamente o sea estrictamente necesario; prioriza siempre indicarle la página que lo hospeda.\n\n';
        for (let i = 0; i < pdfs.length; i++) {
            const p = pdfs[i];
            extra += `### Documento: ${p.titulo}\n`;
            extra += `URL del PDF: ${p.url}\n`;
            extra += `Página donde se encuentra: ${p.foundOn}\n\n`;
        }
    }

    return base + extra;
}

module.exports = {
    loadOfficialData,
    getStaticCacheFields,
    buildBaseInstruction,
    buildSystemInstruction,
    buscarPaginasRelevantes,
    buscarPdfsRelevantes
};
