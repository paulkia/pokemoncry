import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth, usePoke } from "../AppContext";
import { Card, Row, Col, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import AppHeader from "../components/AppHeader";
import { ROUTER_UTIL } from "../library/util";

// Modes: fast vs full
const MODES = ["fast", "full"]; // "fast" = Fast Mode, "full" = Full Mode

// Display names for generations: built dynamically from generationCount
function buildGenLabels(generationCount) {
  const gens = Array.from({ length: generationCount }, (_, i) => {
    const id = `gen${i + 1}`;
    return { id, label: `Gen ${i + 1}` };
  });
  return [...gens, { id: "all", label: "All Gens" }];
}

// Helper for mapping label to Firestore filter value
function toGenFilter(genId) {
  if (!genId || genId === "all") return "all"; // treat null/undefined as all generations
  const match = genId.match(/^gen(\d+)$/);
  return match ? Number(match[1]) : null;
}

function Leaderboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { authUser, authUsername } = useAuth();
  const { generationCount } = usePoke();

  // Defaults from router state: { gen: 'genX'|'all', mode: 'fast'|'full' }
  const defaultGen = location?.state?.gen || "gen1"; // ensure a gen is always selected
  const defaultMode = location?.state?.mode || "fast";

  // State
  const [selectedGen, setSelectedGen] = useState(defaultGen);
  const [selectedMode, setSelectedMode] = useState(defaultMode);
  const [myBest, setMyBest] = useState({
    loading: true,
    data: null,
    error: null,
  });
  const [globalTop, setGlobalTop] = useState({
    loading: true,
    data: [],
    error: null,
  });

  // Build Firestore filters based on selection
  const genFilterValue = useMemo(() => toGenFilter(selectedGen), [selectedGen]);

  // Fetch: My best for selected gen/mode
  useEffect(() => {
    let isMounted = true;
    async function run() {
      setMyBest({ loading: true, data: null, error: null });
      // If user not available yet, wait/show loading
      if (!authUser) {
        setMyBest((prev) => ({ ...prev, loading: false, data: null }));
        return;
      }

      try {
        // Assumption: Firestore collection 'runs' with fields:
        // userId:string, username:string, gen:number|'all', mode:'fast'|'full', score:number, createdAt:timestamp
        const baseRef = collection(db, "runs");
        const q = query(
          baseRef,
          where("userId", "==", authUser.uid),
          where("mode", "==", selectedMode),
          where("gen", "==", genFilterValue),
          orderBy("score", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!isMounted) return;
        if (snap.empty) {
          setMyBest({ loading: false, data: null, error: null });
        } else {
          const doc = snap.docs[0];
          const data = { id: doc.id, ...doc.data() };
          setMyBest({ loading: false, data, error: null });
        }
      } catch (err) {
        console.error("My best fetch failed", err);
        if (!isMounted) return;
        setMyBest({
          loading: false,
          data: null,
          error: err?.message || "Failed to fetch",
        });
      }
    }
    run();
    return () => {
      isMounted = false;
    };
  }, [authUser, selectedMode, genFilterValue]);

  // Fetch: Global top 10 for selected gen/mode
  useEffect(() => {
    let isMounted = true;
    async function run() {
      setGlobalTop({ loading: true, data: [], error: null });
      try {
        const baseRef = collection(db, "runs");
        const q = query(
          baseRef,
          where("mode", "==", selectedMode),
          where("gen", "==", genFilterValue),
          orderBy("score", "desc"),
          limit(10)
        );
        const snap = await getDocs(q);
        if (!isMounted) return;
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setGlobalTop({ loading: false, data: rows, error: null });
      } catch (err) {
        console.error("Global top fetch failed", err);
        if (!isMounted) return;
        setGlobalTop({
          loading: false,
          data: [],
          error: err?.message || "Failed to fetch",
        });
      }
    }
    run();
    return () => {
      isMounted = false;
    };
  }, [selectedMode, genFilterValue]);

  // Derived: compute my rank versus global list (simple client-side rank; server-side preferred in future)
  const myRank = useMemo(() => {
    if (!myBest?.data || !globalTop?.data?.length) return null;
    const betterCount = globalTop.data.filter(
      (r) => (r.score ?? 0) > (myBest.data.score ?? 0)
    ).length;
    return betterCount + 1; // 1-based rank
  }, [myBest, globalTop]);

  // Styled UI
  return (
    <div className="App p-5">
      <AppHeader className="App" />
      <Row className="justify-content-center">
        <Col lg={8} className="col-4 d-flex justify-content-start">
          {" "}
          <Button
            variant="secondary"
            onClick={() => navigate(ROUTER_UTIL.HOME)}
          >
            ← Back to Menu
          </Button>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col lg={8} md={12}>
          <Card className="cute-card mt-3">
            <Card.Header>
              <span style={styles.title}>Leaderboard</span>
            </Card.Header>
            <Card.Body>
              {/* Generation tabs */}
              <div style={styles.tabsWrap}>
                {buildGenLabels(generationCount || 0).map((g) => (
                  <Button
                    key={g.id}
                    variant={
                      selectedGen === g.id ? "primary" : "outline-secondary"
                    }
                    onClick={() => setSelectedGen(g.id)}
                    className="me-2 mb-2"
                  >
                    {g.label}
                  </Button>
                ))}
              </div>
              <div style={styles.separator} />

              {/* Mode toggle */}
              <div style={styles.modeToggleWrap}>
                {MODES.map((m) => (
                  <Button
                    key={m}
                    onClick={() => setSelectedMode(m)}
                    variant={
                      selectedMode === m ? "success" : "outline-secondary"
                    }
                    className="me-2"
                  >
                    {m === "fast" ? "Fast Mode" : "Full Mode"}
                  </Button>
                ))}
              </div>
              <div style={styles.separator} />

              {/* Two-column layout */}
              <Row className="gx-3">
                {/* My Score */}
                <Col md={12} lg={6} className="mb-3">
                  <Card
                    className="cute-card"
                    aria-labelledby="my-score-heading"
                  >
                    <Card.Header className="d-flex justify-content-between align-items-baseline">
                      <h2 id="my-score-heading" style={styles.cardTitle}>
                        My score
                      </h2>
                      <span style={styles.cardSubtitle}>
                        {labelForSelection(
                          selectedGen,
                          selectedMode,
                          generationCount
                        )}
                      </span>
                    </Card.Header>
                    <Card.Body>
                      {myBest.loading ? (
                        <SkeletonLine width={220} />
                      ) : myBest.error ? (
                        <div style={styles.errorText}>
                          Error: {myBest.error}
                        </div>
                      ) : !myBest.data ? (
                        <div style={styles.emptyText}>
                          {`No runs yet. Play a round of ${
                            selectedGen === "all"
                              ? "all gens"
                              : `gen ${toGenFilter(selectedGen)}`
                          } in ${
                            selectedMode === "fast" ? "fast" : "full"
                          } mode to make the board!`}
                        </div>
                      ) : (
                        <div style={styles.myScoreWrap}>
                          <div style={styles.rankBadge}>
                            {myRank ? `Top ${myRank} worldwide` : "Unranked"}
                          </div>
                          <div style={styles.scoreRow}>
                            <div style={styles.scoreLabel}>Score</div>
                            <div style={styles.scoreValue}>
                              {myBest.data.score ?? 0}
                            </div>
                          </div>
                          <div style={styles.metaRow}>
                            <span>Player</span>
                            <span style={styles.metaValue}>
                              {authUsername || "Anonymous"}
                            </span>
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                {/* Global Best */}
                <Col md={12} lg={6} className="mb-3">
                  <Card
                    className="cute-card"
                    aria-labelledby="global-best-heading"
                  >
                    <Card.Header className="d-flex justify-content-between align-items-baseline">
                      <h2 id="global-best-heading" style={styles.cardTitle}>
                        Global best
                      </h2>
                      <span style={styles.cardSubtitle}>
                        Top 10 —{" "}
                        {labelForSelection(
                          selectedGen,
                          selectedMode,
                          generationCount
                        )}
                      </span>
                    </Card.Header>
                    <Card.Body>
                      {globalTop.loading ? (
                        <div>
                          <SkeletonLine width={260} />
                          <SkeletonLine width={240} />
                          <SkeletonLine width={220} />
                        </div>
                      ) : globalTop.error ? (
                        <div style={styles.errorText}>
                          Error: {globalTop.error}
                        </div>
                      ) : globalTop.data.length === 0 ? (
                        <div style={styles.emptyText}>
                          No scores yet. Be the first!
                        </div>
                      ) : (
                        <ol style={styles.list}>
                          {globalTop.data.map((row, idx) => (
                            <li key={row.id} style={styles.listItem}>
                              <span style={styles.listRank}>#{idx + 1}</span>
                              <div style={styles.listUser}>
                                <div style={styles.listName}>
                                  {row.username || "Anonymous"}
                                </div>
                                <div style={styles.listMeta}>
                                  {row.gen === "all"
                                    ? "All gens"
                                    : `Gen ${row.gen}`}{" "}
                                  • {row.mode === "fast" ? "Fast" : "Full"}
                                </div>
                              </div>
                              <div style={styles.listScore}>
                                {row.score ?? 0}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// Small components and helpers
function SkeletonLine({ width = 200 }) {
  return (
    <div
      style={{
        height: 14,
        width,
        borderRadius: 8,
        background: "linear-gradient(90deg, #eee, #f6f6f6, #eee)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.2s linear infinite",
        margin: "6px 0",
      }}
    />
  );
}

function labelForSelection(genId, mode, generationCount) {
  const genLabel =
    !genId || genId === "all" ? "All generations" : `Gen ${toGenFilter(genId)}`;
  const modeLabel = mode === "fast" ? "Fast" : "Full";
  // If generationCount known, ensure within range; else just show label
  return `${genLabel} • ${modeLabel}`;
}

// Inline styles for a clean look
const styles = {
  pageWrap: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 16px 64px",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: "8px 0 20px",
  },
  tabsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    fontSize: 14,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    outline: "none",
    boxShadow: "none",
  },
  tabBtnActive: {
    background: "#0d6efd",
    color: "#fff",
    borderColor: "#0d6efd",
  },
  modeToggleWrap: {
    display: "flex",
    gap: 8,
    margin: "8px 0 24px",
  },
  separator: {
    borderTop: "1px solid #e6e6e6",
    margin: "16px 0",
  },
  modeBtn: {
    fontSize: 14,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
  },
  modeBtnActive: {
    background: "#198754",
    color: "#fff",
    borderColor: "#198754",
  },
  // Using react-bootstrap Row/Col for columns instead of CSS grid
  // Shell when using external cute-card CSS for visual style
  cardShell: {
    overflow: "hidden",
    borderRadius: 12,
  },
  cardHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "16px 16px 8px",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#666",
  },
  cardBody: {
    padding: 16,
  },
  myScoreWrap: {
    display: "grid",
    gap: 10,
  },
  rankBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#f0f7ff",
    color: "#0957d0",
    fontSize: 13,
    border: "1px solid #cfe1ff",
    width: "fit-content",
  },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderRadius: 8,
    background: "#fafafa",
    border: "1px solid #eee",
  },
  scoreLabel: {
    fontSize: 14,
    color: "#666",
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: 700,
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#444",
  },
  metaValue: {
    fontWeight: 600,
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: 8,
  },
  listItem: {
    display: "grid",
    gridTemplateColumns: "60px 1fr 100px",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 8,
    background: "#fafafa",
    border: "1px solid #eee",
  },
  listRank: {
    fontWeight: 700,
    color: "#555",
  },
  listUser: {
    display: "flex",
    flexDirection: "column",
  },
  listName: {
    fontWeight: 600,
  },
  listMeta: {
    fontSize: 12,
    color: "#666",
  },
  listScore: {
    textAlign: "right",
    fontWeight: 700,
    fontSize: 18,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
  },
  errorText: {
    color: "#b00020",
    fontSize: 14,
  },
};

export default Leaderboard;
