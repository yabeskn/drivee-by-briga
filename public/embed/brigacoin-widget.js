/**
 * Unified BrigaCoin Widget — Vanilla JS Drop-in
 * Ekosistem briga.id & Drifee
 *
 * Penggunaan:
 * <div id="brigacoin-widget" data-user-id="USER_ID" data-api-url="https://drifee.briga.id" data-api-key="BRIGA_KEY"></div>
 * <script src="https://drifee.briga.id/embed/brigacoin-widget.js" async></script>
 */

(function () {
  'use strict';

  function initWidget() {
    var containers = document.querySelectorAll('#brigacoin-widget, [data-brigacoin-widget]');
    if (!containers || containers.length === 0) return;

    containers.forEach(function (container) {
      if (container.dataset.initialized) return;
      container.dataset.initialized = 'true';

      var userId = container.getAttribute('data-user-id');
      var apiUrl = (container.getAttribute('data-api-url') || '').replace(/\/$/, '');
      var apiKey = container.getAttribute('data-api-key') || '';
      var theme = container.getAttribute('data-theme') || 'dark';
      var isDark = theme === 'dark';

      if (!userId) {
        container.innerHTML = '<div style="color:#f43f5e;font-size:12px;font-family:sans-serif;">Error: data-user-id diperlukan</div>';
        return;
      }

      var bg = isDark ? '#0f172a' : '#ffffff';
      var border = isDark ? '#1e293b' : '#e2e8f0';
      var text = isDark ? '#f8fafc' : '#0f172a';
      var subtext = isDark ? '#94a3b8' : '#64748b';

      container.innerHTML =
        '<div style="font-family:system-ui,-apple-system,sans-serif;background:' + bg + ';border:1px solid ' + border + ';border-radius:16px;padding:18px;max-width:340px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);color:' + text + ';">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ' + border + ';padding-bottom:10px;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<div style="background:linear-gradient(135deg,#059669,#14b8a6);color:#fff;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;">⚡</div>' +
              '<div>' +
                '<div style="font-size:10px;font-weight:700;letter-spacing:0.5px;color:#10b981;text-transform:uppercase;">Unified Loyalty</div>' +
                '<div style="font-size:13px;font-weight:700;">BrigaCoin Balance</div>' +
              '</div>' +
            '</div>' +
            '<button id="bc-refresh-btn" style="background:transparent;border:1px solid ' + border + ';border-radius:6px;cursor:pointer;padding:4px 8px;font-size:11px;color:' + subtext + ';">↻</button>' +
          '</div>' +
          '<div style="padding:14px 0;">' +
            '<div style="display:flex;align-items:baseline;gap:6px;">' +
              '<span id="bc-balance-val" style="font-size:28px;font-weight:800;color:#10b981;">...</span>' +
              '<span style="font-size:12px;font-weight:700;color:#10b981;">BRC</span>' +
            '</div>' +
            '<div id="bc-idr-val" style="font-size:11px;margin-top:2px;color:' + subtext + ';">≈ Memuat rupiah...</div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid ' + border + ';padding-top:10px;font-size:11px;">' +
            '<div style="background:' + (isDark ? 'rgba(30,41,59,0.5)' : '#f8fafc') + ';padding:8px;border-radius:8px;">' +
              '<div style="color:#10b981;font-weight:600;font-size:10px;">Total Didapat</div>' +
              '<div id="bc-earned-val" style="font-weight:700;margin-top:2px;">...</div>' +
            '</div>' +
            '<div style="background:' + (isDark ? 'rgba(30,41,59,0.5)' : '#f8fafc') + ';padding:8px;border-radius:8px;">' +
              '<div style="color:#06b6d4;font-weight:600;font-size:10px;">Dibelanjakan</div>' +
              '<div id="bc-spent-val" style="font-weight:700;margin-top:2px;">...</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      function loadData() {
        var balElem = container.querySelector('#bc-balance-val');
        var idrElem = container.querySelector('#bc-idr-val');
        var earnedElem = container.querySelector('#bc-earned-val');
        var spentElem = container.querySelector('#bc-spent-val');

        var endpoint = apiUrl + '/api/brigacoin/v1/balance/' + encodeURIComponent(userId);
        var headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

        fetch(endpoint, { headers: headers })
          .then(function (res) { return res.json(); })
          .then(function (json) {
            if (json && json.success && json.data) {
              var bal = json.data.balance || 0;
              var earned = json.data.total_earned || 0;
              var spent = json.data.total_spent || 0;
              var idr = bal * 5000;

              if (balElem) balElem.textContent = bal.toLocaleString('id-ID');
              if (idrElem) idrElem.textContent = '≈ Rp ' + idr.toLocaleString('id-ID') + ' (1 BRC = Rp 5.000)';
              if (earnedElem) earnedElem.textContent = '+' + earned.toLocaleString('id-ID') + ' BRC';
              if (spentElem) spentElem.textContent = '-' + spent.toLocaleString('id-ID') + ' BRC';
            }
          })
          .catch(function (err) {
            if (idrElem) idrElem.textContent = 'Gagal memuat saldo';
          });
      }

      var btn = container.querySelector('#bc-refresh-btn');
      if (btn) btn.addEventListener('click', loadData);

      loadData();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
