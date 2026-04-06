import { useState } from "react";

const tabs = [
  "Vue d'ensemble",
  "Parcours utilisateur",
  "Architecture",
  "Coûts IA / user",
  "Pricing optimal",
  "Roadmap",
  "Logo & branding",
  "Projections"
];

function Overview() {
  return (
    <div>
      <h2 style={{fontSize:'18px',fontWeight:500,marginBottom:'16px',color:'var(--color-text-primary)'}}>DictaBill — Facturation vocale intelligente</h2>
      <p style={{color:'var(--color-text-secondary)',lineHeight:'1.7',marginBottom:'16px',fontSize:'14px'}}>
        Tu parles, l'app facture. L'artisan, le restaurateur, le freelance dicte sa facture en 10 secondes. L'IA transcrit, structure, génère un PDF conforme e-invoicing 2026, et l'envoie au client.
      </p>
      
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'20px'}}>
        {[
          {label:"Cible principale",val:"Artisans, restaurateurs, freelances FR"},
          {label:"Problème résolu",val:"Facturation conforme en <10 sec, mains libres"},
          {label:"Avantage clé",val:"Voice-first + conforme e-invoicing sept. 2026"},
          {label:"Plateformes",val:"iOS (App Store) + Windows (MS Store)"},
        ].map((item,i)=>(
          <div key={i} style={{background:'var(--color-background-secondary)',borderRadius:'8px',padding:'12px 16px'}}>
            <div style={{fontSize:'11px',color:'var(--color-text-tertiary)',marginBottom:'4px'}}>{item.label}</div>
            <div style={{fontSize:'13px',fontWeight:500,color:'var(--color-text-primary)'}}>{item.val}</div>
          </div>
        ))}
      </div>

      <h3 style={{fontSize:'15px',fontWeight:500,marginBottom:'12px',color:'var(--color-text-primary)'}}>Pourquoi maintenant ?</h3>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {[
          {title:"Réforme e-invoicing obligatoire",desc:"Sept. 2026 : réception obligatoire pour toutes les entreprises. Sept. 2027 : émission obligatoire pour les TPE. Des centaines de milliers de petites boîtes doivent s'équiper MAINTENANT."},
          {title:"La voix est le futur de l'input",desc:"Kraaft a prouvé le concept dans le BTP (rapports vocaux sur 600k+ chantiers). Personne ne l'applique proprement à la facturation."},
          {title:"Les gens paient déjà",desc:"Axonaut à 70€/mois, Pennylane à 15€/mois, Evoliz à 16€/mois... Le marché accepte de payer pour la facturation. Mais personne n'est voice-first."},
        ].map((item,i)=>(
          <div key={i} style={{padding:'12px',background:'var(--color-background-secondary)',borderRadius:'8px'}}>
            <div style={{fontWeight:500,fontSize:'13px',color:'var(--color-text-primary)',marginBottom:'4px'}}>{item.title}</div>
            <div style={{fontSize:'12px',color:'var(--color-text-secondary)',lineHeight:'1.6'}}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserJourney() {
  const [step,setStep] = useState(0);
  const steps = [
    {
      title:"1. Inscription (30 sec)",
      screens:[
        {name:"Écran d'accueil",desc:"Logo DictaBill animé. Deux boutons : 'Créer mon compte' et 'J'ai déjà un compte'. Accroche : 'Facturez en parlant.'"},
        {name:"Création du compte",desc:"Email + mot de passe OU connexion Apple/Google (OAuth). Pas de formulaire long — on veut l'utilisateur dans l'app en 30 secondes."},
        {name:"Profil entreprise",desc:"Nom entreprise, SIRET (auto-complétion via API INSEE), adresse, logo (optionnel). L'IA pré-remplit grâce au SIRET. Numéro de TVA intracommunautaire auto-généré."},
        {name:"Personnalisation facture",desc:"Choix d'un template parmi 3 designs. Upload logo. Couleur d'accent. Mentions légales pré-remplies selon le statut juridique (auto-entrepreneur, SARL, SAS...)."},
      ]
    },
    {
      title:"2. Première facture vocale",
      screens:[
        {name:"Dashboard vide",desc:"Message d'accueil : 'Créez votre première facture en parlant'. Gros bouton micro au centre. Tutorial overlay avec 3 étapes (skip possible)."},
        {name:"Enregistrement vocal",desc:"L'utilisateur appuie sur le micro et dit : 'Facture pour le restaurant Le Marais, 3 jours de consulting web, 450 euros par jour, TVA 20 pourcent'. Waveform animé pendant l'enregistrement."},
        {name:"Parsing IA en temps réel",desc:"Transcription Whisper affichée live. Puis l'IA (Haiku 4.5) structure : Client → Le Marais, Prestation → Consulting web, Quantité → 3 jours, Prix unitaire → 450€, TVA → 20%. Animation de remplissage des champs."},
        {name:"Preview & validation",desc:"Aperçu de la facture PDF en temps réel. L'utilisateur peut modifier chaque champ manuellement. Bouton 'Envoyer' + 'Enregistrer brouillon'. Numérotation automatique (FACT-2026-001)."},
      ]
    },
    {
      title:"3. Envoi & suivi",
      screens:[
        {name:"Envoi multi-canal",desc:"Email (PDF en pièce jointe), SMS (lien de paiement), WhatsApp Business (optionnel Pro). Le client reçoit un lien pour voir et payer en ligne."},
        {name:"Portail client",desc:"Le client ouvre le lien → voit la facture → peut payer par CB (Stripe) ou virement. Reçu automatique."},
        {name:"Suivi des paiements",desc:"Dashboard avec statuts : En attente (jaune), Payée (vert), En retard (rouge). Relances automatiques configurables (J+7, J+15, J+30)."},
        {name:"Export comptable",desc:"Export CSV/FEC compatible avec tous les logiciels comptables. Format Factur-X pour e-invoicing. Envoi automatique au comptable par email."},
      ]
    },
    {
      title:"4. Gestion quotidienne",
      screens:[
        {name:"Dashboard principal",desc:"CA du mois, factures en attente, taux d'encaissement, graphique mensuel. Widget 'Facture rapide' (micro) toujours accessible."},
        {name:"Répertoire clients",desc:"Liste des clients avec historique. Ajout par vocal : 'Ajoute le client Dupont Plomberie, 12 rue de la Paix, Paris'. Auto-complétion SIRET."},
        {name:"Catalogue prestations",desc:"Prestations fréquentes enregistrées. L'IA les reconnaît dans le vocal : si tu dis 'carrelage salle de bain', elle retrouve le tarif habituel."},
        {name:"Devis → Facture",desc:"Création de devis avec le même flow vocal. Conversion en facture en 1 clic quand le devis est accepté."},
      ]
    },
  ];

  return (
    <div>
      <h2 style={{fontSize:'18px',fontWeight:500,marginBottom:'16px',color:'var(--color-text-primary)'}}>Parcours utilisateur complet</h2>
      
      <div style={{display:'flex',gap:'4px',marginBottom:'16px',flexWrap:'wrap'}}>
        {steps.map((s,i)=>(
          <button key={i} onClick={()=>setStep(i)} style={{
            padding:'6px 10px',fontSize:'11px',borderRadius:'6px',
            background:step===i?'var(--color-text-primary)':'var(--color-background-secondary)',
            color:step===i?'var(--color-background-primary)':'var(--color-text-secondary)',
            border:'none',cursor:'pointer',fontWeight:step===i?500:400,
          }}>{s.title}</button>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {steps[step].screens.map((screen,i)=>(
          <div key={i} style={{
            display:'flex',gap:'12px',padding:'12px',
            background:'var(--color-background-secondary)',borderRadius:'8px',
            borderLeft:'3px solid var(--color-border-info)',
          }}>
            <div style={{
              width:'24px',height:'24px',borderRadius:'50%',flexShrink:0,
              background:'var(--color-background-info)',color:'var(--color-text-info)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:'12px',fontWeight:500
            }}>{i+1}</div>
            <div>
              <div style={{fontWeight:500,fontSize:'13px',color:'var(--color-text-primary)',marginBottom:'2px'}}>{screen.name}</div>
              <div style={{fontSize:'12px',color:'var(--color-text-secondary)',lineHeight:'1.6'}}>{screen.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Architecture() {
  return (
    <div>
      <h2 style={{fontSize:'18px',fontWeight:500,marginBottom:'16px',color:'var(--color-text-primary)'}}>Architecture technique</h2>
      
      <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'20px'}}>
        {[
          {layer:"Frontend mobile",tech:"React Native (Expo)",why:"Une seule codebase iOS + Android. Tu connais déjà React/JS.",cost:"Gratuit"},
          {layer:"Frontend Windows",tech:"Electron",why:"Même code React que le mobile. Rapide à dev.",cost:"Gratuit"},
          {layer:"Backend API",tech:"Node.js + PostgreSQL",why:"Hébergé sur Railway ou Render (~25€/mois au début).",cost:"~25€/mois"},
          {layer:"Transcription",tech:"GPT-4o Mini Transcribe",why:"$0.003/min. Français excellent (WER ~5-8%).",cost:"0.003$/min"},
          {layer:"Parsing IA",tech:"Claude Haiku 4.5",why:"$1/M input, $5/M output. Ultra rapide pour extraire du JSON.",cost:"~0.001€/facture"},
          {layer:"PDF",tech:"Puppeteer + React-PDF",why:"Gratuit, templates HTML → PDF.",cost:"Gratuit"},
          {layer:"E-invoicing",tech:"Factur-X (lib Node)",why:"Format obligatoire en France. Open-source.",cost:"Gratuit"},
          {layer:"Paiement",tech:"Stripe",why:"1.5% + 0.25€ par transaction.",cost:"1.5%+0.25€/tx"},
          {layer:"Auth",tech:"Supabase Auth",why:"OAuth Google/Apple gratuit.",cost:"Gratuit"},
          {layer:"Stockage",tech:"Cloudflare R2",why:"0.015€/GB/mois pour les PDFs.",cost:"~5€/mois"},
        ].map((item,i)=>(
          <div key={i} style={{
            display:'grid',gridTemplateColumns:'100px 140px minmax(0,1fr) auto',
            gap:'6px',padding:'8px 12px',fontSize:'12px',
            background:'var(--color-background-secondary)',borderRadius:'6px',
            alignItems:'center',
          }}>
            <div style={{fontWeight:500,color:'var(--color-text-primary)'}}>{item.layer}</div>
            <div style={{color:'var(--color-text-info)',fontFamily:'var(--font-mono)',fontSize:'11px'}}>{item.tech}</div>
            <div style={{color:'var(--color-text-secondary)'}}>{item.why}</div>
            <div style={{fontWeight:500,color:'var(--color-text-primary)',whiteSpace:'nowrap',fontSize:'11px'}}>{item.cost}</div>
          </div>
        ))}
      </div>

      <h3 style={{fontSize:'15px',fontWeight:500,marginBottom:'10px',color:'var(--color-text-primary)'}}>Flow d'une facture vocale</h3>
      <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
        {[
          "L'utilisateur appuie sur le micro → enregistrement audio (WebRTC, m4a)",
          "Audio → backend → Whisper API transcrit en texte (~2 sec pour 15 sec d'audio)",
          "Texte → Claude Haiku 4.5 → extraction JSON : {client, prestations[], tva, montant}",
          "Le JSON pré-remplit le formulaire. L'utilisateur valide ou modifie.",
          "Puppeteer génère le PDF conforme + métadonnées Factur-X (XML dans le PDF)",
          "PDF stocké sur R2. Email/SMS envoyé au client avec lien Stripe.",
          "Webhook Stripe notifie le paiement → statut mis à jour en temps réel.",
        ].map((item,i)=>(
          <div key={i} style={{display:'flex',gap:'8px',padding:'6px 10px',alignItems:'baseline'}}>
            <div style={{
              width:'20px',height:'20px',borderRadius:'50%',flexShrink:0,
              background:'var(--color-background-info)',color:'var(--color-text-info)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:'10px',fontWeight:500
            }}>{i+1}</div>
            <div style={{fontSize:'12px',color:'var(--color-text-secondary)',lineHeight:'1.5'}}>{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AICosts() {
  const [facturesParJour,setFacturesParJour] = useState(5);
  const [dureeVocale,setDureeVocale] = useState(15);
  const [users,setUsers] = useState(500);

  const whisperCostPerMin = 0.003;
  const avgInputTokens = 500;
  const avgOutputTokens = 200;

  const whisperPerFacture = (dureeVocale/60)*whisperCostPerMin;
  const haikuPerFacture = (avgInputTokens/1e6)*1+(avgOutputTokens/1e6)*5;
  const totalPerFacture = whisperPerFacture+haikuPerFacture;
  const totalPerUserPerMonth = totalPerFacture*facturesParJour*22;
  const totalMensuelTousUsers = totalPerUserPerMonth*users;
  const euroRate = 0.92;

  return (
    <div>
      <h2 style={{fontSize:'18px',fontWeight:500,marginBottom:'16px',color:'var(--color-text-primary)'}}>Coûts IA par utilisateur — Simulateur</h2>
      
      <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'20px'}}>
        {[
          {label:"Factures/jour/utilisateur",value:facturesParJour,min:1,max:20,set:setFacturesParJour,display:facturesParJour},
          {label:"Durée moyenne vocal (sec)",value:dureeVocale,min:5,max:60,set:setDureeVocale,display:dureeVocale+"s"},
          {label:"Utilisateurs actifs",value:users,min:10,max:5000,set:setUsers,display:users,step:10},
        ].map((s,i)=>(
          <div key={i}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
              <label style={{fontSize:'12px',color:'var(--color-text-secondary)'}}>{s.label}</label>
              <span style={{fontSize:'12px',fontWeight:500}}>{s.display}</span>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.step||1} value={s.value} onChange={e=>s.set(+e.target.value)} style={{width:'100%'}}/>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
        {[
          {label:"Whisper / facture",val:(whisperPerFacture*100*euroRate).toFixed(3)+" cts €",sub:"GPT-4o Mini Transcribe · $0.003/min"},
          {label:"Claude Haiku / facture",val:(haikuPerFacture*100*euroRate).toFixed(3)+" cts €",sub:"~500 tok in + ~200 tok out"},
          {label:"Coût IA total / facture",val:(totalPerFacture*100*euroRate).toFixed(2)+" cts €",sub:"Whisper + Haiku combinés",accent:true},
          {label:"Coût IA / user / mois",val:(totalPerUserPerMonth*euroRate).toFixed(2)+" €",sub:facturesParJour+" fact/jour × 22 jours",accent:true},
        ].map((c,i)=>(
          <div key={i} style={{background:c.accent?'var(--color-background-info)':'var(--color-background-secondary)',borderRadius:'8px',padding:'10px 14px'}}>
            <div style={{fontSize:'11px',color:c.accent?'var(--color-text-info)':'var(--color-text-tertiary)'}}>{c.label}</div>
            <div style={{fontSize:'18px',fontWeight:500,color:c.accent?'var(--color-text-info)':'var(--color-text-primary)'}}>{c.val}</div>
            <div style={{fontSize:'10px',color:c.accent?'var(--color-text-info)':'var(--color-text-tertiary)',opacity:0.7}}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{background:'var(--color-background-secondary)',borderRadius:'8px',padding:'14px',marginBottom:'12px'}}>
        <div style={{fontSize:'12px',color:'var(--color-text-secondary)',marginBottom:'6px'}}>Coût IA mensuel total ({users} utilisateurs)</div>
        <div style={{fontSize:'26px',fontWeight:500,color:'var(--color-text-primary)'}}>{(totalMensuelTousUsers*euroRate).toFixed(0)} € / mois</div>
        <div style={{fontSize:'11px',color:'var(--color-text-tertiary)',marginTop:'4px'}}>
          = {(users*facturesParJour*22).toLocaleString()} factures/mois
        </div>
      </div>

      <div style={{padding:'12px',borderRadius:'8px',border:'0.5px solid var(--color-border-success)',background:'var(--color-background-success)'}}>
        <div style={{fontSize:'12px',fontWeight:500,color:'var(--color-text-success)',marginBottom:'2px'}}>Marge nette sur l'IA</div>
        <div style={{fontSize:'12px',color:'var(--color-text-success)',lineHeight:'1.6'}}>
          À 9,99€/mois avec un coût IA de {(totalPerUserPerMonth*euroRate).toFixed(2)}€/user/mois, ta marge brute sur l'IA est de {(((9.99-totalPerUserPerMonth*euroRate)/9.99)*100).toFixed(0)}%. La quasi-totalité du prix est de la marge.
        </div>
      </div>
    </div>
  );
}

function Pricing() {
  const [annual,setAnnual] = useState(false);
  const plans = [
    {
      name:"Gratuit",price:"0€",priceAnnual:"0€",period:"",desc:"Pour tester",
      features:["5 factures / mois","Facturation vocale IA","1 template de facture","Export PDF","Marque 'DictaBill' sur les factures"],
      highlight:false,why:"Acquisition. L'utilisateur teste, voit la magie du vocal, et veut plus."
    },
    {
      name:"Solo",price:"9,99€",priceAnnual:"7,49€",period:"/mois",desc:"Freelances & indépendants",
      features:["Factures illimitées","Facturation vocale IA","5 templates personnalisables","Sans marque DictaBill","Relances automatiques","Devis + conversion en facture","Export comptable (CSV, FEC)","Conforme e-invoicing 2026"],
      highlight:true,why:"Sweet spot. 80% des users seront ici. Marge ~95%."
    },
    {
      name:"Pro",price:"24,99€",priceAnnual:"19,99€",period:"/mois",desc:"TPE & petites équipes",
      features:["Tout Solo +","Jusqu'à 5 utilisateurs","Paiement en ligne (Stripe)","Portail client personnalisé","Intégration comptable (API)","WhatsApp Business","Catalogue prestations intelligent","Support prioritaire"],
      highlight:false,why:"Upsell naturel pour les TPE avec employés."
    },
  ];

  return (
    <div>
      <h2 style={{fontSize:'18px',fontWeight:500,marginBottom:'6px',color:'var(--color-text-primary)'}}>Pricing optimal</h2>
      <p style={{marginBottom:'14px',fontSize:'12px',color:'var(--color-text-secondary)'}}>
        Objectif : maximiser le revenu en restant sous les concurrents (Axonaut 70€, Sellsy 49€, Evoliz 16€).
      </p>

      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px',justifyContent:'center'}}>
        <span style={{fontSize:'12px',color:!annual?'var(--color-text-primary)':'var(--color-text-tertiary)',fontWeight:!annual?500:400}}>Mensuel</span>
        <div onClick={()=>setAnnual(!annual)} style={{
          width:'36px',height:'20px',borderRadius:'10px',cursor:'pointer',position:'relative',
          background:annual?'var(--color-text-info)':'var(--color-border-secondary)',transition:'background 0.2s',
        }}>
          <div style={{
            width:'16px',height:'16px',borderRadius:'50%',background:'white',position:'absolute',top:'2px',
            left:annual?'18px':'2px',transition:'left 0.2s',
          }}/>
        </div>
        <span style={{fontSize:'12px',color:annual?'var(--color-text-primary)':'var(--color-text-tertiary)',fontWeight:annual?500:400}}>Annuel (-25%)</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
        {plans.map((plan,i)=>(
          <div key={i} style={{
            background:'var(--color-background-primary)',borderRadius:'10px',padding:'14px',
            border:plan.highlight?'2px solid var(--color-border-info)':'0.5px solid var(--color-border-tertiary)',
            position:'relative',
          }}>
            {plan.highlight&&(
              <div style={{
                position:'absolute',top:'-9px',left:'50%',transform:'translateX(-50%)',
                background:'var(--color-background-info)',color:'var(--color-text-info)',
                fontSize:'10px',padding:'2px 8px',borderRadius:'6px',fontWeight:500
              }}>Recommandé</div>
            )}
            <div style={{fontSize:'14px',fontWeight:500,color:'var(--color-text-primary)'}}>{plan.name}</div>
            <div style={{fontSize:'10px',color:'var(--color-text-tertiary)',marginBottom:'6px'}}>{plan.desc}</div>
            <div style={{marginBottom:'10px'}}>
              <span style={{fontSize:'22px',fontWeight:500,color:'var(--color-text-primary)'}}>{annual?plan.priceAnnual:plan.price}</span>
              <span style={{fontSize:'12px',color:'var(--color-text-tertiary)'}}>{plan.period}</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'10px'}}>
              {plan.features.map((f,j)=>(
                <div key={j} style={{fontSize:'11px',color:'var(--color-text-secondary)',display:'flex',gap:'4px',alignItems:'baseline'}}>
                  <span style={{color:'var(--color-text-success)',fontSize:'8px'}}>●</span>{f}
                </div>
              ))}
            </div>
            <div style={{fontSize:'10px',color:'var(--color-text-tertiary)',fontStyle:'italic',borderTop:'0.5px solid var(--color-border-tertiary)',paddingTop:'6px'}}>{plan.why}</div>
          </div>
        ))}
      </div>

      <div style={{fontSize:'12px',color:'var(--color-text-secondary)',lineHeight:'1.7'}}>
        <p style={{marginBottom:'6px'}}><strong>9,99€/mois Solo</strong> — Prix psychologique sous 10€. 3x moins cher qu'Evoliz, 7x moins qu'Axonaut. 500 abonnés = 5000€/mois.</p>
        <p style={{marginBottom:'6px'}}><strong>24,99€/mois Pro</strong> — 2.5x le Solo, justifié par multi-utilisateurs + intégrations.</p>
        <p><strong>Le gratuit est essentiel</strong> — 5 factures/mois suffit pour tester. Taux de conversion attendu : 8-12%.</p>
      </div>
    </div>
  );
}

function Roadmap() {
  const weeks = [
    {period:"Semaines 1-2",title:"Backend & IA core",tasks:["Setup Node.js + PostgreSQL (Railway)","API REST : auth, clients, factures","Intégration Whisper + Claude Haiku","Génération PDF + Factur-X"],bg:'var(--color-background-info)',fg:'var(--color-text-info)'},
    {period:"Semaines 3-4",title:"App mobile MVP",tasks:["Inscription (OAuth + email)","Profil entreprise (auto SIRET)","Enregistrement vocal + parsing IA","Preview facture + envoi email"],bg:'var(--color-background-success)',fg:'var(--color-text-success)'},
    {period:"Semaines 5-6",title:"Windows + Polish",tasks:["Port Electron + packaging MS Store","Devis + conversion facture","Relances auto + tests beta (20-30 users)"],bg:'var(--color-background-warning)',fg:'var(--color-text-warning)'},
    {period:"Semaine 7",title:"Soumission stores",tasks:["Apple App Store + Microsoft Store","Landing page + vidéo démo","Préparation lancement ProductHunt"],bg:'var(--color-background-danger)',fg:'var(--color-text-danger)'},
    {period:"Semaine 8+",title:"Lancement & Growth",tasks:["ProductHunt launch day","TikTok 'Je facture en parlant'","LinkedIn artisans + partenariats comptables","SEO 'facturation vocale 2026'"],bg:'var(--color-background-secondary)',fg:'var(--color-text-secondary)'},
  ];
  return (
    <div>
      <h2 style={{fontSize:'18px',fontWeight:500,marginBottom:'16px',color:'var(--color-text-primary)'}}>Roadmap — 8 semaines</h2>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {weeks.map((w,i)=>(
          <div key={i} style={{borderRadius:'8px',border:'0.5px solid var(--color-border-tertiary)',overflow:'hidden'}}>
            <div style={{padding:'8px 14px',background:w.bg,display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'11px',fontWeight:500,color:w.fg}}>{w.period}</span>
              <span style={{fontSize:'13px',fontWeight:500,color:w.fg}}>{w.title}</span>
            </div>
            <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:'4px'}}>
              {w.tasks.map((t,j)=>(
                <div key={j} style={{fontSize:'12px',color:'var(--color-text-secondary)',display:'flex',gap:'6px',alignItems:'baseline'}}>
                  <span style={{color:'var(--color-text-tertiary)',fontSize:'8px'}}>○</span>{t}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Branding() {
  return (
    <div>
      <h2 style={{fontSize:'18px',fontWeight:500,marginBottom:'16px',color:'var(--color-text-primary)'}}>Logo, branding & coûts</h2>
      
      <div style={{background:'var(--color-background-secondary)',borderRadius:'10px',padding:'20px',marginBottom:'16px',textAlign:'center'}}>
        <div style={{fontSize:'42px',fontWeight:600,letterSpacing:'-2px',color:'var(--color-text-primary)',marginBottom:'2px'}}>
          factur<span style={{color:'#1D9E75'}}>'</span>ia
        </div>
        <div style={{fontSize:'11px',color:'var(--color-text-tertiary)',letterSpacing:'3px',textTransform:'uppercase'}}>Tu parles, on facture</div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
        {[
          {item:"Logo icon",desc:"Micro stylisé → se transforme en facture. Vert #1D9E75.",cost:"0-100€"},
          {item:"Typographie",desc:"Inter ou Outfit (gratuit). SF Pro (iOS) + Segoe UI (Windows).",cost:"0€"},
          {item:"Palette",desc:"Primaire #1D9E75, secondaire #0F6E56, accent #EF9F27.",cost:"0€"},
          {item:"Icône App Store",desc:"1024x1024 PNG. Fond vert, micro blanc. Lisible en 29x29.",cost:"0-50€"},
          {item:"Screenshots stores",desc:"5-6 screenshots avec mockup device. Templates Figma Community.",cost:"0€"},
          {item:"Templates PDF",desc:"3 designs : Minimaliste, Classique, Moderne. HTML/CSS.",cost:"0€"},
        ].map((item,i)=>(
          <div key={i} style={{padding:'10px 14px',background:'var(--color-background-secondary)',borderRadius:'6px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}>
              <span style={{fontWeight:500,fontSize:'13px',color:'var(--color-text-primary)'}}>{item.item}</span>
              <span style={{fontSize:'11px',color:'var(--color-text-success)',fontWeight:500}}>{item.cost}</span>
            </div>
            <div style={{fontSize:'12px',color:'var(--color-text-secondary)',lineHeight:'1.5'}}>{item.desc}</div>
          </div>
        ))}
      </div>

      <div style={{background:'var(--color-background-success)',borderRadius:'8px',padding:'12px 14px',marginBottom:'16px'}}>
        <div style={{fontSize:'20px',fontWeight:500,color:'var(--color-text-success)'}}>Budget branding total : 0€ à 200€</div>
        <div style={{fontSize:'12px',color:'var(--color-text-success)',marginTop:'4px'}}>Tout faisable gratuitement (Figma + Canva). Logo pro sur Fiverr si besoin.</div>
      </div>

      <h3 style={{fontSize:'15px',fontWeight:500,marginBottom:'10px',color:'var(--color-text-primary)'}}>Frais stores & infra</h3>
      <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
        {[
          {store:"Apple App Store",fee:"99$/an (~91€)",note:"Obligatoire. Apple prend 15% (Small Business Program)."},
          {store:"Microsoft Store",fee:"19$ one-time (~17€)",note:"Frais unique. Microsoft prend 15% sur les abonnements."},
          {store:"Google Play",fee:"25$ one-time (~23€)",note:"Optionnel (Android). Google prend 15% sur le 1er M$."},
          {store:"Stripe",fee:"1.5% + 0.25€/tx",note:"Paiement en ligne pour le plan Pro."},
          {store:"Hébergement",fee:"~25-75€/mois",note:"Railway/Render. Scale avec les users."},
          {store:"Cloudflare R2",fee:"~5-15€/mois",note:"Stockage PDFs. 0.015€/GB."},
        ].map((item,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'110px 90px minmax(0,1fr)',gap:'6px',padding:'8px 12px',fontSize:'12px',background:'var(--color-background-secondary)',borderRadius:'6px',alignItems:'center'}}>
            <div style={{fontWeight:500,color:'var(--color-text-primary)'}}>{item.store}</div>
            <div style={{fontWeight:500,color:'var(--color-text-info)',fontFamily:'var(--font-mono)',fontSize:'11px'}}>{item.fee}</div>
            <div style={{color:'var(--color-text-secondary)'}}>{item.note}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:'12px',background:'var(--color-background-secondary)',borderRadius:'8px',padding:'12px 14px'}}>
        <div style={{fontSize:'13px',fontWeight:500,color:'var(--color-text-primary)',marginBottom:'4px'}}>Investissement initial total</div>
        <div style={{fontSize:'12px',color:'var(--color-text-secondary)',lineHeight:'1.6'}}>
          Compte Apple (91€) + Microsoft (17€) + 1er mois hébergement (25€) + branding (0-200€) = <strong>133€ à 333€</strong> pour démarrer. C'est tout. Pas de levée de fonds nécessaire.
        </div>
      </div>
    </div>
  );
}

function Projections() {
  const [convRate,setConvRate] = useState(10);
  const months = [
    {m:1,freeUsers:200},{m:2,freeUsers:600},{m:3,freeUsers:1500},{m:4,freeUsers:3000},
    {m:5,freeUsers:5000},{m:6,freeUsers:8000},{m:7,freeUsers:11000},{m:8,freeUsers:14000},
    {m:9,freeUsers:18000},{m:10,freeUsers:22000},{m:11,freeUsers:26000},{m:12,freeUsers:30000},
  ];

  const proRatio = 0.15;
  const projections = months.map(m=>{
    const paying = Math.round(m.freeUsers*(convRate/100));
    const solo = Math.round(paying*(1-proRatio));
    const pro = Math.round(paying*proRatio);
    const mrr = solo*9.99+pro*24.99;
    const commission = mrr*0.15;
    const aiCost = paying*0.05*22;
    const infra = 25+(m.freeUsers>5000?50:0)+(m.freeUsers>15000?100:0);
    const net = mrr-commission-aiCost-infra;
    return {...m,paying,solo,pro,mrr,net};
  });

  const maxMrr = Math.max(...projections.map(p=>p.mrr));
  
  return (
    <div>
      <h2 style={{fontSize:'18px',fontWeight:500,marginBottom:'16px',color:'var(--color-text-primary)'}}>Projections financières — 12 mois</h2>
      
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px'}}>
        <label style={{fontSize:'12px',color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>Conversion gratuit → payant</label>
        <input type="range" min="3" max="20" value={convRate} onChange={e=>setConvRate(+e.target.value)} style={{flex:1}}/>
        <span style={{fontSize:'13px',fontWeight:500,minWidth:'32px',textAlign:'right'}}>{convRate}%</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
        <div style={{background:'var(--color-background-secondary)',borderRadius:'8px',padding:'10px 14px'}}>
          <div style={{fontSize:'11px',color:'var(--color-text-tertiary)'}}>MRR Mois 6</div>
          <div style={{fontSize:'20px',fontWeight:500,color:'var(--color-text-primary)'}}>{Math.round(projections[5].mrr).toLocaleString()}€</div>
        </div>
        <div style={{background:'var(--color-background-secondary)',borderRadius:'8px',padding:'10px 14px'}}>
          <div style={{fontSize:'11px',color:'var(--color-text-tertiary)'}}>MRR Mois 12</div>
          <div style={{fontSize:'20px',fontWeight:500,color:'var(--color-text-primary)'}}>{Math.round(projections[11].mrr).toLocaleString()}€</div>
        </div>
        <div style={{background:'var(--color-background-success)',borderRadius:'8px',padding:'10px 14px'}}>
          <div style={{fontSize:'11px',color:'var(--color-text-success)'}}>Net Mois 12</div>
          <div style={{fontSize:'20px',fontWeight:500,color:'var(--color-text-success)'}}>{Math.round(projections[11].net).toLocaleString()}€</div>
        </div>
      </div>

      <div style={{marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:'var(--color-text-tertiary)',marginBottom:'6px'}}>Évolution du MRR</div>
        <div style={{display:'flex',alignItems:'end',gap:'3px',height:'100px'}}>
          {projections.map((p,i)=>(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%'}}>
              <div style={{fontSize:'9px',fontWeight:500,color:'var(--color-text-primary)',marginBottom:'2px'}}>
                {p.mrr>=1000?Math.round(p.mrr/1000)+'k':Math.round(p.mrr)}
              </div>
              <div style={{
                width:'100%',borderRadius:'3px 3px 0 0',
                height:`${Math.max(4,(p.mrr/maxMrr)*85)}%`,
                background:p.mrr>=5000?'var(--color-text-success)':'var(--color-text-info)',
                opacity:0.7,
              }}/>
              <div style={{fontSize:'9px',color:'var(--color-text-tertiary)',marginTop:'2px'}}>M{p.m}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{fontSize:'12px',overflowX:'auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'50px 70px 60px 70px 60px',gap:'2px',padding:'6px 0',borderBottom:'0.5px solid var(--color-border-tertiary)',color:'var(--color-text-tertiary)',fontWeight:500,fontSize:'11px'}}>
          <div>Mois</div><div>Free</div><div>Payants</div><div>MRR</div><div>Net</div>
        </div>
        {projections.map((p,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'50px 70px 60px 70px 60px',gap:'2px',padding:'4px 0',borderBottom:'0.5px solid var(--color-border-tertiary)',color:'var(--color-text-secondary)',fontSize:'11px'}}>
            <div style={{fontWeight:500,color:'var(--color-text-primary)'}}>M{p.m}</div>
            <div>{p.freeUsers.toLocaleString()}</div>
            <div>{p.paying}</div>
            <div style={{fontWeight:500,color:p.mrr>=5000?'var(--color-text-success)':'var(--color-text-primary)'}}>{Math.round(p.mrr).toLocaleString()}€</div>
            <div style={{color:p.net>=5000?'var(--color-text-success)':'var(--color-text-secondary)'}}>{Math.round(p.net).toLocaleString()}€</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:'14px',padding:'12px',borderRadius:'8px',background:'var(--color-background-warning)',border:'0.5px solid var(--color-border-warning)'}}>
        <div style={{fontSize:'12px',fontWeight:500,color:'var(--color-text-warning)',marginBottom:'2px'}}>Note réaliste</div>
        <div style={{fontSize:'11px',color:'var(--color-text-warning)',lineHeight:'1.6'}}>
          Ces projections supposent un effort marketing constant (3-5 vidéos TikTok/semaine, posts LinkedIn, SEO actif). 
          L'objectif de 5000€/mois est atteignable au mois {projections.findIndex(p=>p.mrr>=5000)+1 || '12+'} avec un taux de conversion de {convRate}%.
        </div>
      </div>
    </div>
  );
}

export default function dictabillPlan() {
  const [activeTab,setActiveTab] = useState(0);
  const C = [Overview,UserJourney,Architecture,AICosts,Pricing,Roadmap,Branding,Projections][activeTab];
  return (
    <div style={{fontFamily:'var(--font-sans)',maxWidth:'100%'}}>
      <div style={{display:'flex',gap:'1px',marginBottom:'16px',overflowX:'auto',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
        {tabs.map((tab,i)=>(
          <button key={i} onClick={()=>setActiveTab(i)} style={{
            padding:'7px 10px',fontSize:'11px',border:'none',cursor:'pointer',
            background:'transparent',
            color:activeTab===i?'var(--color-text-primary)':'var(--color-text-tertiary)',
            fontWeight:activeTab===i?500:400,
            borderBottom:activeTab===i?'2px solid var(--color-text-primary)':'2px solid transparent',
            whiteSpace:'nowrap',
          }}>{tab}</button>
        ))}
      </div>
      <C/>
    </div>
  );
}
