let ipcData = {};

fetch('ipc_data.json')
    .then(response => response.json())
    .then(data => { ipcData = data; })
    .catch(error => console.error('Error cargando el histórico IPC:', error));

document.getElementById('btn-add-capital').addEventListener('click', () => {
    const container = document.getElementById('lista-capitales');
    const row = document.createElement('div');
    row.className = 'capital-row grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-blue-50/50 p-5 rounded-xl border border-blue-100 transition-all';
    row.innerHTML = `
        <div class="md:col-span-6">
            <label class="block text-sm font-bold text-gray-800 mb-1">💰 Capital Base (COP)</label>
            <p class="text-xs text-gray-500 mb-2">Monto histórico original adeudado o pagado.</p>
            <input type="number" required min="1" step="any" class="capital-input w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="Ej: 2000000">
        </div>
        <div class="md:col-span-5">
            <label class="block text-sm font-bold text-gray-800 mb-1">📅 Fecha Causación</label>
            <p class="text-xs text-gray-500 mb-2">Mes exacto en que nació la obligación.</p>
            <input type="month" required class="fecha-inicial-input w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
        </div>
        <div class="md:col-span-1 flex justify-center pb-3">
            <button type="button" class="btn-eliminar text-red-400 hover:text-red-600 transition" title="Eliminar fila">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </div>
    `;
    container.appendChild(row);
});

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

document.getElementById('calc-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const fechaFinal = document.getElementById('fecha-final').value;
    const conIntereses = document.getElementById('check-intereses').checked;
    const filas = document.querySelectorAll('.capital-row');
    
    let totalHistorico = 0;
    let totalIndexado = 0;
    let totalIntereses = 0;
    let memoriaCalculos = [];
    let errorBloqueante = false;

    if (!ipcData[fechaFinal]) {
        mostrarError(`No hay índice DANE disponible para la fecha final global (${fechaFinal}).`);
        return;
    }
    const ipcFinal = ipcData[fechaFinal].indice;
    let [anioFinN, mesFinN] = fechaFinal.split('-').map(Number);

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

        // Cálculo de intereses si está activo (0.5% mensual sobre capital indexado)
        let interesCivil = 0;
        let mesesMora = 0;
        if (conIntereses) {
            let [anioIni, mesIni] = fechaInicial.split('-').map(Number);
            mesesMora = ((anioFinN - anioIni) * 12) + (mesFinN - mesIni);
            if (mesesMora < 0) mesesMora = 0;
            interesCivil = capitalIndexado * (0.005 * mesesMora);
        }

        const totalRubro = capitalIndexado + interesCivil;

        totalHistorico += capital;
        totalIndexado += capitalIndexado;
        totalIntereses += interesCivil;

        memoriaCalculos.push({
            numero: index + 1,
            fecha: fechaInicial,
            capital: capital,
            ipcInicial: ipcInicial,
            factor: factor,
            indexado: capitalIndexado,
            mesesMora: mesesMora,
            interes: interesCivil,
            total: totalRubro
        });
    });

    if (errorBloqueante) return;
    document.getElementById('error-msg').classList.add('hidden');

    const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
    const granTotalFinal = totalIndexado + totalIntereses;

    // Actualizar Cajas UI
    document.getElementById('total-historico').textContent = formatoCOP.format(totalHistorico);
    document.getElementById('valor-actualizado').textContent = formatoCOP.format(granTotalFinal);
    
    const boxIntereses = document.getElementById('box-intereses');
    const boxGranTotal = document.getElementById('box-gran-total');
    
    if (conIntereses) {
        boxIntereses.classList.remove('hidden');
        document.getElementById('total-intereses').textContent = formatoCOP.format(totalIntereses);
        boxGranTotal.classList.replace('md:col-span-1', 'md:col-span-1');
    } else {
        boxIntereses.classList.add('hidden');
        boxGranTotal.classList.replace('md:col-span-1', 'md:col-span-2');
    }
    
    // Generar Texto Legal
    let textoMemorial = `Para la presente liquidación, se aplicó la fórmula jurisprudencial de indexación (Valor Actualizado = Valor Histórico * IPC Final / IPC Inicial) individualmente. Se procesaron ${memoriaCalculos.length} obligaciones históricas (${formatoCOP.format(totalHistorico)}). Al traerlos a valor presente (${fechaFinal}, IPC ${ipcFinal}), el capital indexado es de ${formatoCOP.format(totalIndexado)}.`;
    
    if (conIntereses) {
        textoMemorial += ` Adicionalmente, conforme al artículo 1617 del Código Civil, se liquidaron intereses moratorios legales a una tasa del 6% anual (0.5% mensual) sobre el capital indexado por cada mes de mora, sumando ${formatoCOP.format(totalIntereses)} por este concepto.`;
    }
    textoMemorial += ` El GRAN TOTAL A PAGAR asciende a la suma de ${formatoCOP.format(granTotalFinal)}.`;
    
    document.getElementById('texto-legal').textContent = textoMemorial;
    
    // Construir Tabla Dinámica
    const thead = document.getElementById('tabla-head');
    const tbody = document.getElementById('tabla-desglose');
    tbody.innerHTML = ''; 
    
    let cabecerasHtml = `
        <tr>
            <th scope="col" class="px-4 py-3 w-12">No.</th>
            <th scope="col" class="px-4 py-3">Causación</th>
            <th scope="col" class="px-4 py-3 text-right">Cap. Base</th>
            <th scope="col" class="px-4 py-3 text-center">Factor</th>
            <th scope="col" class="px-4 py-3 text-right">Cap. Indexado</th>
    `;
    if (conIntereses) {
        cabecerasHtml += `
            <th scope="col" class="px-4 py-3 text-center">Meses Mora</th>
            <th scope="col" class="px-4 py-3 text-right">Interés (6%)</th>
        `;
    }
    cabecerasHtml += `<th scope="col" class="px-4 py-3 text-right">Total Pagar</th></tr>`;
    thead.innerHTML = cabecerasHtml;

    memoriaCalculos.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50";
        let filasHtml = `
            <td class="px-4 py-3 font-bold text-slate-500">${c.numero}</td>
            <td class="px-4 py-3 text-slate-700">${c.fecha}</td>
            <td class="px-4 py-3 text-right">${formatoCOP.format(c.capital)}</td>
            <td class="px-4 py-3 text-center font-mono text-xs">${c.factor.toFixed(5)}</td>
            <td class="px-4 py-3 text-right font-medium">${formatoCOP.format(c.indexado)}</td>
        `;
        if (conIntereses) {
            filasHtml += `
                <td class="px-4 py-3 text-center">${c.mesesMora}</td>
                <td class="px-4 py-3 text-right text-indigo-600">${formatoCOP.format(c.interes)}</td>
            `;
        }
        filasHtml += `<td class="px-4 py-3 text-right text-emerald-700 font-bold">${formatoCOP.format(c.total)}</td>`;
        tr.innerHTML = filasHtml;
        tbody.appendChild(tr);
    });

    const colSpanTotales = conIntereses ? 4 : 4; 
    const tfoot = document.createElement('tr');
    tfoot.className = "bg-slate-100 border-t-2 border-slate-300";
    let totalesHtml = `
        <td colspan="2" class="px-4 py-4 text-right font-black text-slate-800 text-xs">TOTALES:</td>
        <td class="px-4 py-4 text-right font-black text-slate-800">${formatoCOP.format(totalHistorico)}</td>
        <td class="px-4 py-4 text-right"></td>
        <td class="px-4 py-4 text-right font-black text-slate-800">${formatoCOP.format(totalIndexado)}</td>
    `;
    if (conIntereses) {
        totalesHtml += `
            <td class="px-4 py-4"></td>
            <td class="px-4 py-4 text-right font-black text-indigo-700">${formatoCOP.format(totalIntereses)}</td>
        `;
    }
    totalesHtml += `<td class="px-4 py-4 text-right font-black text-emerald-800 text-lg">${formatoCOP.format(granTotalFinal)}</td>`;
    tfoot.innerHTML = totalesHtml;
    tbody.appendChild(tfoot);

    document.getElementById('resultado-section').classList.remove('hidden');
});

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
        btn.innerHTML = '✓ Copiado con éxito';
        btn.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
        setTimeout(() => {
            btn.innerHTML = contenidoOriginal;
            btn.classList.remove('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
        }, 2000);
    });
});

document.getElementById('btn-descargar-pdf').addEventListener('click', () => window.print());