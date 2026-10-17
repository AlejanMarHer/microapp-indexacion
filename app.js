let ipcData = {};

fetch('ipc_data.json')
    .then(response => response.json())
    .then(data => { ipcData = data; })
    .catch(error => console.error('Error cargando el histórico IPC:', error));

document.getElementById('calc-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const capital = parseFloat(document.getElementById('capital').value);
    const fechaInicial = document.getElementById('fecha-inicial').value; 
    const fechaFinal = document.getElementById('fecha-final').value;
    
    const errorMsg = document.getElementById('error-msg');
    const resultadoSection = document.getElementById('resultado-section');

    // Validaciones
    if (fechaFinal < fechaInicial) {
        mostrarError("Error procesal: La fecha final no puede ser anterior a la fecha inicial.");
        return;
    }

    if (!ipcData[fechaInicial] || !ipcData[fechaFinal]) {
        mostrarError("Error: Los índices para este rango de fechas no están disponibles en la base de datos.");
        return;
    }

    errorMsg.classList.add('hidden');

    // Cálculos Generales
    const ipcInicial = ipcData[fechaInicial].indice;
    const ipcFinal = ipcData[fechaFinal].indice;
    
    const factorIndexacion = ipcFinal / ipcInicial;
    const capitalActualizado = capital * factorIndexacion;

    const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
    const capitalFormateado = formatoCOP.format(capital);
    const actualizadoFormateado = formatoCOP.format(capitalActualizado);

    document.getElementById('valor-actualizado').textContent = actualizadoFormateado;
    
    const textoMemorial = `Para efectos de la presente liquidación, se aplicó la fórmula de indexación o corrección monetaria avalada por la jurisprudencia colombiana: Valor Actualizado = Valor Histórico * (IPC Final / IPC Inicial). En el caso en concreto: ${capitalFormateado} * (${ipcFinal} / ${ipcInicial}) arrojando un total indexado de ${actualizadoFormateado}. Los índices aplicados corresponden a la serie empalmada oficial del DANE.`;
    
    document.getElementById('texto-legal').textContent = textoMemorial;
    
    // --- NUEVO: Generación de la Tabla Mes a Mes ---
    generarTablaDesglose(capital, fechaInicial, fechaFinal, ipcInicial, formatoCOP);

    resultadoSection.classList.remove('hidden');
});

function generarTablaDesglose(capital, fechaInicial, fechaFinal, ipcBaseInicial, formatoCOP) {
    const tbody = document.getElementById('tabla-desglose');
    tbody.innerHTML = ''; // Limpiar tabla anterior

    // Lógica para iterar mes a mes desde fechaInicial hasta fechaFinal
    let [anioActual, mesActual] = fechaInicial.split('-').map(Number);
    const [anioFin, mesFin] = fechaFinal.split('-').map(Number);
    
    // Nombres de meses para la UI
    const nombresMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    while (anioActual < anioFin || (anioActual === anioFin && mesActual <= mesFin)) {
        // Asegurar formato YYYY-MM
        const llaveMes = `${anioActual}-${mesActual.toString().padStart(2, '0')}`;
        
        // Verificar si existe el dato en el JSON
        if (ipcData[llaveMes]) {
            const ipcMes = ipcData[llaveMes].indice;
            // El factor hasta ESE mes es el IPC de ese mes dividido por el IPC del mes inicial (Base)
            const factorAcumulado = ipcMes / ipcBaseInicial;
            const capitalAlMes = capital * factorAcumulado;

            // Construir la fila HTML
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors";
            
            tr.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap font-medium text-gray-900">${nombresMeses[mesActual-1]} ${anioActual}</td>
                <td class="px-4 py-3">${ipcMes}</td>
                <td class="px-4 py-3">${factorAcumulado.toFixed(6)}</td>
                <td class="px-4 py-3 text-right text-emerald-700 font-semibold">${formatoCOP.format(capitalAlMes)}</td>
            `;
            
            tbody.appendChild(tr);
        }

        // Avanzar al siguiente mes
        mesActual++;
        if (mesActual > 12) {
            mesActual = 1;
            anioActual++;
        }
    }
}

function mostrarError(mensaje) {
    const errorMsg = document.getElementById('error-msg');
    errorMsg.textContent = mensaje;
    errorMsg.classList.remove('hidden');
    document.getElementById('resultado-section').classList.add('hidden');
}

document.getElementById('btn-copiar').addEventListener('click', function() {
    const texto = document.getElementById('texto-legal').textContent;
    navigator.clipboard.writeText(texto).then(() => {
        const btn = this;
        const contenidoOriginal = btn.innerHTML;
        
        btn.innerHTML = '✓ ¡Copiado con éxito!';
        btn.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
        
        setTimeout(() => {
            btn.innerHTML = contenidoOriginal;
            btn.classList.remove('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
        }, 2000);
    });
});
// --- NUEVO: Exportación a PDF Nativa ---
document.getElementById('btn-descargar-pdf').addEventListener('click', function() {
    window.print(); // Invoca el motor nativo del navegador
});