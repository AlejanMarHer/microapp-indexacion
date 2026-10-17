let ipcData = {};

// Carga inicial de la base de datos
fetch('ipc_data.json')
    .then(response => response.json())
    .then(data => { ipcData = data; })
    .catch(error => console.error('Error cargando el histórico IPC:', error));

// 1. Lógica Dinámica para agregar y eliminar filas de capital
document.getElementById('btn-add-capital').addEventListener('click', () => {
    const container = document.getElementById('lista-capitales');
    const row = document.createElement('div');
    row.className = 'capital-row grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-blue-50/50 p-5 rounded-xl border border-blue-100 transition-all';
    row.innerHTML = `
        <div class="md:col-span-6">
            <label class="block text-sm font-bold text-gray-700 mb-2">💰 Capital Base (COP)</label>
            <input type="number" required min="1" step="any" class="capital-input w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="Ej: 2000000">
        </div>
        <div class="md:col-span-5">
            <label class="block text-sm font-bold text-gray-700 mb-2">📅 Fecha Causación</label>
            <input type="month" required class="fecha-inicial-input w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
        </div>
        <div class="md:col-span-1 flex justify-center pb-2">
            <button type="button" class="btn-eliminar text-red-400 hover:text-red-600 transition" title="Eliminar fila">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </div>
    `;
    container.appendChild(row);
});

// Delegación de eventos para eliminar fila
document.getElementById('lista-capitales').addEventListener('click', (e) => {
    const btnEliminar = e.target.closest('.btn-eliminar');
    if (btnEliminar) {
        if (document.querySelectorAll('.capital-row').length > 1) {
            btnEliminar.closest('.capital-row').remove();
        } else {
            mostrarError("El memorial debe contener al menos un capital a liquidar.");
        }
    }
});

// 2. Motor de Cálculo Iterativo
document.getElementById('calc-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const fechaFinal = document.getElementById('fecha-final').value;
    const filas = document.querySelectorAll('.capital-row');
    
    let totalHistorico = 0;
    let totalActualizado = 0;
    let memoriaCalculos = [];
    let errorBloqueante = false;

    // Validar Fecha Final global
    if (!ipcData[fechaFinal]) {
        mostrarError(`No hay índice DANE disponible para la fecha final global (${fechaFinal}).`);
        return;
    }
    const ipcFinal = ipcData[fechaFinal].indice;

    // Iterar sobre cada rubro ingresado
    filas.forEach((fila, index) => {
        const capital = parseFloat(fila.querySelector('.capital-input').value);
        const fechaInicial = fila.querySelector('.fecha-inicial-input').value;

        if (fechaInicial > fechaFinal) {
            mostrarError(`Error en rubro ${index + 1}: La fecha de causación no puede ser posterior a la fecha de actualización.`);
            errorBloqueante = true;
            return;
        }

        if (!ipcData[fechaInicial]) {
            mostrarError(`Error en rubro ${index + 1}: Índice no encontrado para la fecha (${fechaInicial}).`);
            errorBloqueante = true;
            return;
        }

        const ipcInicial = ipcData[fechaInicial].indice;
        const factor = ipcFinal / ipcInicial;
        const capitalIndexado = capital * factor;

        totalHistorico += capital;
        totalActualizado += capitalIndexado;

        memoriaCalculos.push({
            numero: index + 1,
            fecha: fechaInicial,
            capital: capital,
            ipcInicial: ipcInicial,
            factor: factor,
            indexado: capitalIndexado
        });
    });

    if (errorBloqueante) return;
    document.getElementById('error-msg').classList.add('hidden');

    const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });

    // Inyectar Totales UI
    document.getElementById('total-historico').textContent = formatoCOP.format(totalHistorico);
    document.getElementById('valor-actualizado').textContent = formatoCOP.format(totalActualizado);
    
    // Inyectar Texto Legal
    const textoMemorial = `Para la presente liquidación consolidada, se aplicó la fórmula jurisprudencial de indexación (Valor Actualizado = Valor Histórico * IPC Final / IPC Inicial) de manera individual a cada rubro reclamado. Se procesaron ${memoriaCalculos.length} obligaciones históricas que sumaban un capital base de ${formatoCOP.format(totalHistorico)}. Al aplicar los respectivos factores de actualización a la fecha de corte (${fechaFinal} con IPC ${ipcFinal}), la sumatoria arroja un GRAN TOTAL INDEXADO de ${formatoCOP.format(totalActualizado)}. Los índices fueron extraídos de la serie empalmada del DANE.`;
    document.getElementById('texto-legal').textContent = textoMemorial;
    
    // Generar Tabla Matriz
    const tbody = document.getElementById('tabla-desglose');
    tbody.innerHTML = ''; 

    memoriaCalculos.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
            <td class="px-4 py-3 font-bold text-slate-500">${c.numero}</td>
            <td class="px-4 py-3 text-slate-700">${c.fecha}</td>
            <td class="px-4 py-3 text-right font-medium">${formatoCOP.format(c.capital)}</td>
            <td class="px-4 py-3 text-center text-slate-500">${c.ipcInicial}</td>
            <td class="px-4 py-3 text-center text-slate-500 font-mono text-xs">${c.factor.toFixed(6)}</td>
            <td class="px-4 py-3 text-right text-emerald-700 font-bold">${formatoCOP.format(c.indexado)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Fila de Sumatorias Inferior
    const tfoot = document.createElement('tr');
    tfoot.className = "bg-slate-100 border-t-2 border-slate-300";
    tfoot.innerHTML = `
        <td colspan="2" class="px-4 py-4 text-right font-black text-slate-800 uppercase text-xs">TOTALES CONSOLIDADOS:</td>
        <td class="px-4 py-4 text-right font-black text-slate-800">${formatoCOP.format(totalHistorico)}</td>
        <td colspan="2" class="px-4 py-4 text-center text-slate-500 font-mono text-xs">IPC Final: ${ipcFinal}</td>
        <td class="px-4 py-4 text-right font-black text-emerald-800 text-lg">${formatoCOP.format(totalActualizado)}</td>
    `;
    tbody.appendChild(tfoot);

    document.getElementById('resultado-section').classList.remove('hidden');
});

// Utilidades
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

document.getElementById('btn-descargar-pdf').addEventListener('click', () => window.print());