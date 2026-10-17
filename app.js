let ipcData = {};

fetch('ipc_data.json')
    .then(response => response.json())
    .then(data => { ipcData = data; })
    .catch(error => console.error('Error cargando histórico IPC:', error));

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
    
    let totalHistorico = 0, totalIndexado = 0, totalIntereses = 0;
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
            mostrarError(`Error en rubro ${index + 1}: La causación no puede ser posterior a la actualización.`);
            errorBloqueante = true; return;
        }
        if (!ipcData[fechaInicial]) {
            mostrarError(`Error en rubro ${index + 1}: Índice no encontrado para (${fechaInicial}).`);
            errorBloqueante = true; return;
        }

        const ipcInicial = ipcData[fechaInicial].indice;
        const factor = ipcFinal / ipcInicial;
        const capitalIndexado = capital * factor;

        let interesCivil = 0, mesesMora = 0;
        if (conIntereses) {
            let [anioIni, mesIni] = fechaInicial.split('-').map(Number);
            mesesMora = ((anioFinN - anioIni) * 12) + (mesFinN - mesIni);
            if (mesesMora < 0) mesesMora = 0;
            interesCivil = capitalIndexado * (0.005 * mesesMora);
        }

        totalHistorico += capital;
        totalIndexado += capitalIndexado;
        totalIntereses += interesCivil;

        memoriaCalculos.push({
            numero: index + 1, fecha: fechaInicial, capital: capital,
            ipcInicial: ipcInicial, factor: factor, indexado: capitalIndexado,
            mesesMora: mesesMora, interes: interesCivil, total: capitalIndexado + interesCivil
        });
    });

    if (errorBloqueante) return;
    document.getElementById('error-msg').classList.add('hidden');

    const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
    const granTotalFinal = totalIndexado + totalIntereses;

    // Actualizar Totales y Textos
    document.getElementById('total-historico').textContent = formatoCOP.format(totalHistorico);
    document.getElementById('valor-actualizado').textContent = formatoCOP.format(granTotalFinal);
    
    if (conIntereses) {
        document.getElementById('box-intereses').classList.remove('hidden');
        document.getElementById('total-intereses').textContent = formatoCOP.format(totalIntereses);
        document.getElementById('box-gran-total').classList.replace('md:col-span-2', 'md:col-span-1');
    } else {
        document.getElementById('box-intereses').classList.add('hidden');
        document.getElementById('box-gran-total').classList.replace('md:col-span-1', 'md:col-span-2');
    }
    
    let textoMemorial = `Para la presente liquidación, se aplicó la fórmula jurisprudencial de indexación (Va = Vh * IPC Final / IPC Inicial). Se procesaron ${memoriaCalculos.length} obligaciones (${formatoCOP.format(totalHistorico)}). Al traerlos a valor presente (${fechaFinal}, IPC ${ipcFinal}), el capital indexado es de ${formatoCOP.format(totalIndexado)}.`;
    if (conIntereses) textoMemorial += ` Conforme al art. 1617 del C.C., se liquidaron intereses moratorios civiles (0.5% mensual) sobre el capital indexado, sumando ${formatoCOP.format(totalIntereses)}.`;
    textoMemorial += ` El GRAN TOTAL A PAGAR es de ${formatoCOP.format(granTotalFinal)}.`;
    document.getElementById('texto-legal').textContent = textoMemorial;
    
    // Matriz Resumen (Pantalla Principal)
    const thead = document.getElementById('tabla-head');
    const tbody = document.getElementById('tabla-desglose');
    tbody.innerHTML = ''; 
    
    let cabecerasHtml = `<tr><th class="px-4 py-3">No.</th><th class="px-4 py-3">Causación</th><th class="px-4 py-3 text-right">Cap. Base</th><th class="px-4 py-3 text-center">Factor</th><th class="px-4 py-3 text-right">Indexado</th>`;
    if (conIntereses) cabecerasHtml += `<th class="px-4 py-3 text-center">Mora</th><th class="px-4 py-3 text-right">Interés</th>`;
    cabecerasHtml += `<th class="px-4 py-3 text-right">Total Pagar</th></tr>`;
    thead.innerHTML = cabecerasHtml;

    memoriaCalculos.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50";
        let fHtml = `<td class="px-4 py-3 font-bold text-slate-500">${c.numero}</td><td class="px-4 py-3 text-slate-700">${c.fecha}</td><td class="px-4 py-3 text-right">${formatoCOP.format(c.capital)}</td><td class="px-4 py-3 text-center font-mono text-xs">${c.factor.toFixed(5)}</td><td class="px-4 py-3 text-right font-medium">${formatoCOP.format(c.indexado)}</td>`;
        if (conIntereses) fHtml += `<td class="px-4 py-3 text-center">${c.mesesMora}</td><td class="px-4 py-3 text-right text-indigo-600">${formatoCOP.format(c.interes)}</td>`;
        fHtml += `<td class="px-4 py-3 text-right text-emerald-700 font-bold">${formatoCOP.format(c.total)}</td>`;
        tr.innerHTML = fHtml;
        tbody.appendChild(tr);
    });

    const tfoot = document.createElement('tr');
    tfoot.className = "bg-slate-100 border-t-2 border-slate-300";
    let tHtml = `<td colspan="2" class="px-4 py-4 text-right font-black text-slate-800 text-xs">TOTALES:</td><td class="px-4 py-4 text-right font-black text-slate-800">${formatoCOP.format(totalHistorico)}</td><td class="px-4 py-4"></td><td class="px-4 py-4 text-right font-black text-slate-800">${formatoCOP.format(totalIndexado)}</td>`;
    if (conIntereses) tHtml += `<td class="px-4 py-4"></td><td class="px-4 py-4 text-right font-black text-indigo-700">${formatoCOP.format(totalIntereses)}</td>`;
    tHtml += `<td class="px-4 py-4 text-right font-black text-emerald-800 text-lg">${formatoCOP.format(granTotalFinal)}</td>`;
    tfoot.innerHTML = tHtml;
    tbody.appendChild(tfoot);

    // NUEVO: GENERADOR DE ANEXOS MES A MES (Oculto en Pantalla, Visible en PDF)
    const anexosContainer = document.getElementById('anexos-detalle');
    anexosContainer.innerHTML = ''; 
    const nombresMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    memoriaCalculos.forEach(c => {
        let htmlAnexo = `
        <div class="page-break print-clean">
            <h3 class="text-lg font-bold text-slate-800 mb-4 uppercase border-b border-gray-300 pb-2">Anexo: Evolución Mensual - Rubro No. ${c.numero} (Causado en ${c.fecha})</h3>
            <div class="border border-gray-300">
                <table class="w-full text-sm text-left text-gray-600">
                    <thead class="text-xs text-slate-700 uppercase bg-slate-100 border-b border-gray-300">
                        <tr>
                            <th class="px-4 py-2">Periodo</th>
                            <th class="px-4 py-2 text-center">IPC Mes DANE</th>
                            <th class="px-4 py-2 text-center">Factor Acumulado</th>
                            <th class="px-4 py-2 text-right">Capital Indexado</th>
                            ${conIntereses ? '<th class="px-4 py-2 text-center">Meses Mora</th><th class="px-4 py-2 text-right">Interés (0.5% M)</th><th class="px-4 py-2 text-right">Total a Pagar</th>' : ''}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
        `;

        let [anioActual, mesActual] = c.fecha.split('-').map(Number);
        
        while (anioActual < anioFinN || (anioActual === anioFinN && mesActual <= mesFinN)) {
            const llaveMes = `${anioActual}-${mesActual.toString().padStart(2, '0')}`;
            if (ipcData[llaveMes]) {
                const ipcMes = ipcData[llaveMes].indice;
                const factorMes = ipcMes / c.ipcInicial;
                const indexadoMes = c.capital * factorMes;

                let interesMes = 0; let mesesMoraMes = 0; let totalMes = indexadoMes;
                if (conIntereses) {
                    let [anioIni, mesIni] = c.fecha.split('-').map(Number);
                    mesesMoraMes = ((anioActual - anioIni) * 12) + (mesActual - mesIni);
                    if (mesesMoraMes < 0) mesesMoraMes = 0;
                    interesMes = indexadoMes * (0.005 * mesesMoraMes);
                    totalMes = indexadoMes + interesMes;
                }

                htmlAnexo += `
                    <tr>
                        <td class="px-4 py-2">${nombresMeses[mesActual-1]} ${anioActual}</td>
                        <td class="px-4 py-2 text-center">${ipcMes}</td>
                        <td class="px-4 py-2 text-center font-mono text-xs">${factorMes.toFixed(6)}</td>
                        <td class="px-4 py-2 text-right">${formatoCOP.format(indexadoMes)}</td>
                        ${conIntereses ? `
                            <td class="px-4 py-2 text-center">${mesesMoraMes}</td>
                            <td class="px-4 py-2 text-right text-indigo-600">${formatoCOP.format(interesMes)}</td>
                            <td class="px-4 py-2 text-right font-bold text-emerald-700">${formatoCOP.format(totalMes)}</td>
                        ` : ''}
                    </tr>
                `;
            }
            mesActual++;
            if (mesActual > 12) { mesActual = 1; anioActual++; }
        }

        htmlAnexo += `</tbody></table></div></div>`;
        anexosContainer.innerHTML += htmlAnexo;
    });

    document.getElementById('resultado-section').classList.remove('hidden');
});

function mostrarError(mensaje) {
    const errorMsg = document.getElementById('error-msg');
    errorMsg.textContent = mensaje;
    errorMsg.classList.remove('hidden');
    document.getElementById('resultado-section').classList.add('hidden');
}

document.getElementById('btn-copiar').addEventListener('click', function() {
    navigator.clipboard.writeText(document.getElementById('texto-legal').textContent).then(() => {
        const btn = this; const orig = btn.innerHTML;
        btn.innerHTML = '✓ Copiado con éxito';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
    });
});

document.getElementById('btn-descargar-pdf').addEventListener('click', () => window.print());