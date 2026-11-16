// The board's annotations layer: the selection frame and inspector on the name, and the two tools at work:
// the Designer's long-handled filbert and the Critic's hexagonal pencil (drawn as SVG; scene.js places them).
export const notesHTML = `<div class="layer" id="notes" aria-hidden="true">
    <div class="sel"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="insp"></div>
    <div class="tool d">
      <svg class="mark" viewBox="0 0 1 1"><path pathLength="1" d="M0 0 C18 -9 40 5 74 -7" stroke="#1B2A9E" stroke-width="10"/><path pathLength="1" d="M1 -2.6 C19 -11.5 41 2.5 73 -9.6" stroke="#4E66E0" stroke-width="1.6"/><path pathLength="1" d="M2 2.6 C20 -6.5 42 7.5 72 -4.6" stroke="#121C70" stroke-width="1.3"/></svg>
      <div class="body"><svg class="sh" viewBox="0 0 40 200"><path d="M18 8 Q20 3.5 22 8 L24.6 140 Q24.9 147 24.4 150 L25.4 172 C27.2 180 25.5 191 20 198 C14.5 191 12.8 180 14.6 172 L15.6 150 Q15.1 147 15.4 140 Z"/></svg><svg class="sh s2" viewBox="0 0 40 200"><path d="M18 8 Q20 3.5 22 8 L24.6 140 Q24.9 147 24.4 150 L25.4 172 C27.2 180 25.5 191 20 198 C14.5 191 12.8 180 14.6 172 L15.6 150 Q15.1 147 15.4 140 Z"/></svg>
        <svg class="obj" viewBox="0 0 40 200">
          <defs>
            <linearGradient id="bh" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#2E44C4"/><stop offset=".28" stop-color="#4860E2"/><stop offset=".55" stop-color="#1B2A9E"/><stop offset="1" stop-color="#0C1358"/></linearGradient>
            <linearGradient id="bt" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#F47B2E"/><stop offset=".3" stop-color="#FF9A4F"/><stop offset=".6" stop-color="#EC6220"/><stop offset="1" stop-color="#A93E0A"/></linearGradient>
            <linearGradient id="bf" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#70778B"/><stop offset=".16" stop-color="#EEF0F6"/><stop offset=".36" stop-color="#A9AFC0"/><stop offset=".56" stop-color="#FAFBFD"/><stop offset=".78" stop-color="#868DA1"/><stop offset="1" stop-color="#4E5468"/></linearGradient>
            <linearGradient id="bb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#E2D2AE"/><stop offset=".22" stop-color="#B9B4C6"/><stop offset=".5" stop-color="#4A60D6"/><stop offset="1" stop-color="#14207F"/></linearGradient>
            <clipPath id="bc"><path d="M18 8 Q20 3.5 22 8 L24.6 140 Q24.9 147 24.4 150 L15.6 150 Q15.1 147 15.4 140 Z"/></clipPath>
          </defs>
          <path d="M18 8 Q20 3.5 22 8 L24.6 140 Q24.9 147 24.4 150 L15.6 150 Q15.1 147 15.4 140 Z" fill="url(#bh)"/>
          <g clip-path="url(#bc)"><rect x="10" y="0" width="20" height="27" fill="url(#bt)"/><rect x="10" y="27" width="20" height="1.6" fill="#F3D48A"/><rect x="10" y="30.2" width="20" height=".8" fill="#F3D48A"/>
            <path d="M18.6 12 L17.2 142" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round"/><path d="M23.2 34 L24.2 146" stroke="#060A3A" stroke-opacity=".45" stroke-width="1.2"/></g>
          <path d="M15.6 150 L24.4 150 L25.4 172 L14.6 172 Z" fill="url(#bf)"/>
          <path d="M15.5 154.2h9M15.4 156.4h9.2M14.8 169h10.4" stroke="#3E4458" stroke-opacity=".55" stroke-width=".7"/><path d="M15.5 155.3h9" stroke="#fff" stroke-opacity=".7" stroke-width=".5"/>
          <path d="M14.6 172 C12.8 180 14.5 191 20 198 C25.5 191 27.2 180 25.4 172 Z" fill="url(#bb)"/>
          <path d="M16.4 173 C15.4 181 16.6 189 19.4 195.5M18.3 173 C17.8 182 18.6 190 19.8 196.5M20.2 173 C20.6 182 20.6 190 20.2 196.8M22 173 C22.8 181 22.4 189 20.8 196M23.8 173 C24.8 180 23.8 188 21.4 195" fill="none" stroke="#0E1766" stroke-opacity=".5" stroke-width=".45"/>
          <path d="M17.2 173 C16.4 180 17.2 186 18.6 191M21.2 173 C21.8 179 21.6 185 21 190" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".4"/>
          <path d="M24.6 181 C26.6 185 25.6 190.5 22.6 194.4 C24.2 190 24.9 185.5 24.6 181 Z" fill="#6F86F0"/><path d="M15.2 176.5 C14.2 182 15.2 187 17 190.6" fill="none" stroke="#0A1052" stroke-opacity=".6" stroke-width=".8"/>
        </svg>
        <span class="tag">Designer</span></div>
    </div>
    <div class="tool c">
      <svg class="mark" viewBox="0 0 1 1"><path pathLength="1" d="M19 1 C17 13 4 19 -9 15 C-22 10 -23 -6 -11 -14 C1 -21 20 -15 21 0 C22 8 15 15 6 17" stroke="#EC6220" stroke-width="2.1"/></svg>
      <div class="body"><svg class="sh" viewBox="0 0 28 170"><path d="M9.2 5 Q9.2 1.5 14 1.5 Q18.8 1.5 18.8 5 L19.5 22 L19.5 138 L14 168 L8.5 138 L8.5 22 Z"/></svg><svg class="sh s2" viewBox="0 0 28 170"><path d="M9.2 5 Q9.2 1.5 14 1.5 Q18.8 1.5 18.8 5 L19.5 22 L19.5 138 L14 168 L8.5 138 L8.5 22 Z"/></svg>
        <svg class="obj" viewBox="0 0 28 170">
          <defs>
            <linearGradient id="pw" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#F3DDB8"/><stop offset=".45" stop-color="#E2C08D"/><stop offset="1" stop-color="#B58A55"/></linearGradient>
            <linearGradient id="pf" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#737A8E"/><stop offset=".2" stop-color="#F1F3F8"/><stop offset=".45" stop-color="#A7ADBE"/><stop offset=".62" stop-color="#F8F9FC"/><stop offset="1" stop-color="#555B6F"/></linearGradient>
            <linearGradient id="pe" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#E6AEAA"/><stop offset=".4" stop-color="#D99390"/><stop offset="1" stop-color="#A9615F"/></linearGradient>
          </defs>
          <path d="M8.5 136 L14 168 L19.5 136 Z" fill="url(#pw)"/>
          <path d="M11.2 142 L13.2 160M13.9 141 L14 158M16.6 142 L15 159" stroke="#A67C48" stroke-opacity=".4" stroke-width=".4" fill="none"/>
          <path d="M12.3 157.6 L14 168 L15.7 157.6 Q14 156.6 12.3 157.6 Z" fill="#2A2D3B"/><path d="M13.3 159 L13.9 165.6" stroke="#fff" stroke-opacity=".45" stroke-width=".5" stroke-linecap="round"/>
          <path d="M8.5 22 L12.3 22 L12.3 141.5 Q10.4 147.5 8.5 139 Z" fill="#F7935A"/>
          <path d="M12.3 22 L16.3 22 L16.3 141.5 Q14.3 150 12.3 141.5 Z" fill="#EC6220"/>
          <path d="M16.3 22 L19.5 22 L19.5 139 Q17.9 147.5 16.3 141.5 Z" fill="#B4420D"/>
          <path d="M9.4 24 L9.4 136" stroke="#fff" stroke-opacity=".35" stroke-width=".7"/>
          <rect x="8.5" y="29" width="11" height="1.5" fill="#F3D48A"/><rect x="8.5" y="32" width="11" height=".7" fill="#F3D48A"/>
          <path d="M13.2 40v2.4M14.3 39.4v5M15.4 40v3M13.2 46.5v6M14.3 47v3.6M15.4 46.5v5.4M13.2 56v2M14.3 55.4v4.4" stroke="#F8DFA0" stroke-opacity=".85" stroke-width=".55"/>
          <path d="M8.3 9.5 h11.4 L19.5 22.4 L8.5 22.4 Z" fill="url(#pf)"/><path d="M8.4 12.2h11.2M8.4 14.2h11.2M8.5 19.6h11" stroke="#3E4458" stroke-opacity=".55" stroke-width=".65"/><path d="M8.4 13.2h11.2" stroke="#fff" stroke-opacity=".7" stroke-width=".45"/>
          <path d="M9.2 5 Q9.2 1.5 14 1.5 Q18.8 1.5 18.8 5 L18.9 9.6 L9.1 9.6 Z" fill="url(#pe)"/>
        </svg>
        <span class="tag">Critic</span></div>
    </div>
  </div>`;
