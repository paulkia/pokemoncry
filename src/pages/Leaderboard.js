import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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

const disabledUsername = "Anonymous";

const GLOBAL_LIMIT = 10;
const NEARBY_LIMIT = 3;

const BASE_COLLECTION = "public-runs";

export const fetchMyBest = async ({ uid, mode, gen }) => {
  const q = query(
    collection(db, BASE_COLLECTION),
    where("uid", "==", uid),
    where("mode", "==", mode),
    where("gen", "==", gen),
    orderBy("score", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const fetchNearbyScores = async ({ mode, gen, playerScore }) => {
  const baseRef = collection(db, "public-runs");

  // Fetch 3 scores higher than player's score
  const qAbove = query(
    baseRef,
    where("mode", "==", mode),
    where("gen", "==", gen),
    where("score", ">", playerScore),
    where("username", "!=", disabledUsername), // Exclude anonymous users from global leaderboard
    orderBy("score", "asc"), // ascending to get closest higher scores
    limit(NEARBY_LIMIT)
  );

  // Fetch 3 scores lower than player's score
  const qBelow = query(
    baseRef,
    where("mode", "==", mode),
    where("gen", "==", gen),
    where("score", "<", playerScore),
    where("username", "!=", disabledUsername), // Exclude anonymous users from global leaderboard
    orderBy("score", "desc"), // descending to get closest lower scores
    limit(NEARBY_LIMIT)
  );

  const [snapAbove, snapBelow] = await Promise.all([
    getDocs(qAbove),
    getDocs(qBelow),
  ]);

  let aboveReverseOrder = snapAbove.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  const below = snapBelow.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { aboveReverseOrder, below };
};

export const fetchGlobalTop = async ({
  mode,
  gen,
  disabledUsername,
  limitCount,
}) => {
  const q = query(
    collection(db, BASE_COLLECTION),
    where("mode", "==", mode),
    where("gen", "==", gen),
    where("username", "!=", disabledUsername),
    orderBy("score", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Modes: fast vs full
const MODES = ["fast", "full"]; // "fast" = Fast Mode, "full" = Full Mode

// Display names for generations: built dynamically from generationCount
function buildGenLabels(generationCount) {
  const gens = Array.from({ length: generationCount }, (_, i) => {
    const id = i + 1;
    return { id, label: `Gen ${i + 1}` };
  });
  return [...gens, { id: "all", label: "All Gens" }];
}

function Leaderboard() {
  const location = useLocation();
  const { authUser, authUsername } = useAuth();
  const { generationCount } = usePoke();

  // State
  const [selectedGen, setSelectedGen] = useState(location?.state?.gen || 1);
  const [selectedMode, setSelectedMode] = useState(
    location?.state?.mode || "fast"
  );

  // 1. Fetch: My Best
  const myBestQuery = useQuery({
    queryKey: ["myBest", authUser?.uid, selectedMode, selectedGen],
    queryFn: () =>
      fetchMyBest({ uid: authUser.uid, mode: selectedMode, gen: selectedGen }),
    enabled: !!authUser?.uid, // Only run if logged in
  });

  const playerScore = myBestQuery.data?.score;

  // 2. Fetch: Global Top
  const globalQuery = useQuery({
    queryKey: ["globalTop", selectedMode, selectedGen],
    queryFn: () =>
      fetchGlobalTop({
        mode: selectedMode,
        gen: selectedGen,
        disabledUsername: "Anonymous",
        limitCount: GLOBAL_LIMIT,
      }),
  });

  // 3. Fetch: Nearby (Dependent Query)
  const nearbyQuery = useQuery({
    queryKey: ["nearby", selectedMode, selectedGen, playerScore],
    queryFn: () =>
      fetchNearbyScores({
        mode: selectedMode,
        gen: selectedGen,
        playerScore: playerScore,
      }),
    enabled: !!playerScore, // IMPORTANT: Only run once we have the player's score
  });

  if (
    selectedGen < 0 ||
    (generationCount !== 0 && selectedGen > generationCount)
  ) {
    throw new Error("Invalid generation selected");
  }
  if (selectedMode !== "fast" && selectedMode !== "full") {
    throw new Error("Invalid mode selected");
  }

  // Derived: compute my rank versus global list (simple client-side rank; server-side preferred in future)
  const myRank = useMemo(() => {
    if (!playerScore || !globalQuery?.data?.length) return null;
    const betterCount = globalQuery.data.filter(
      (r) => (r.score ?? 0) > playerScore
    ).length;
    return betterCount + 1; // 1-based rank
  }, [playerScore, globalQuery.data]);

  // Styled UI
  return (
    <span>
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
                <Col lg={12} xl={6} className="mb-3">
                  <Card
                    className="cute-card"
                    aria-labelledby="my-score-heading"
                  >
                    <Card.Header className="d-flex justify-content-between align-items-baseline">
                      <h2 id="my-score-heading" style={styles.cardTitle}>
                        Personal Best
                      </h2>
                      <span style={styles.cardSubtitle}>
                        {labelForSelection(selectedGen, selectedMode)}
                      </span>
                    </Card.Header>
                    <Card.Body>
                      {myBestQuery.isLoading ? (
                        <SkeletonLine width={220} />
                      ) : myBestQuery.isError ? (
                        <div style={styles.errorText}>
                          Error: {myBestQuery.error.message}
                        </div>
                      ) : !myBestQuery.data ? (
                        <div style={styles.emptyText}>
                          {`No runs yet. Play a round of ${
                            selectedGen === "all"
                              ? "all gens"
                              : `gen ${selectedGen || "all"}`
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
                              {myBestQuery.data.score ?? 0}
                            </div>
                          </div>
                          <div style={styles.metaRow}>
                            <span>Player</span>
                            <span style={styles.metaValue}>
                              {authUsername ||
                                "Create a username to submit scores!"}
                            </span>
                          </div>

                          {/* Nearby scores context */}
                          {!nearbyQuery.isLoading &&
                            (nearbyQuery.data.aboveReverseOrder.length > 0 ||
                              nearbyQuery.data.below.length > 0) && (
                              <>
                                <div style={styles.separator} />
                                <div style={styles.nearbyTitle}>
                                  Nearby Players
                                </div>
                                <ol style={styles.nearbyList}>
                                  {/* Players above (reverse to show highest first) */}
                                  {nearbyQuery.data.aboveReverseOrder.map(
                                    (row) => (
                                      <li
                                        key={row.id}
                                        style={styles.nearbyItem}
                                      >
                                        <div style={styles.nearbyUser}>
                                          <div style={styles.nearbyName}>
                                            {row.username}
                                          </div>
                                        </div>
                                        <div style={styles.nearbyScore}>
                                          {row.score ?? 0}
                                        </div>
                                      </li>
                                    )
                                  )}

                                  {/* Current player (highlighted) */}
                                  <li
                                    style={{
                                      ...styles.nearbyItem,
                                      ...styles.nearbyItemCurrent,
                                    }}
                                  >
                                    <div style={styles.nearbyUser}>
                                      <div style={styles.nearbyName}>
                                        {authUsername || "Anonymous"}{" "}
                                        <span style={styles.youBadge}>YOU</span>
                                      </div>
                                    </div>
                                    <div style={styles.nearbyScore}>
                                      {myBestQuery.data.score ?? 0}
                                    </div>
                                  </li>

                                  {/* Players below */}
                                  {nearbyQuery.data.below.map((row) => (
                                    <li key={row.id} style={styles.nearbyItem}>
                                      <div style={styles.nearbyUser}>
                                        <div style={styles.nearbyName}>
                                          {row.username}
                                        </div>
                                      </div>
                                      <div style={styles.nearbyScore}>
                                        {row.score ?? 0}
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              </>
                            )}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                {/* Global Best */}
                <Col lg={12} xl={6} className="mb-3">
                  <Card
                    className="cute-card"
                    aria-labelledby="global-best-heading"
                  >
                    <Card.Header className="d-flex justify-content-between align-items-baseline">
                      <h2 id="global-best-heading" style={styles.cardTitle}>
                        Global Best
                      </h2>
                      <span style={styles.cardSubtitle}>
                        Top 10 — {labelForSelection(selectedGen, selectedMode)}
                      </span>
                    </Card.Header>
                    <Card.Body>
                      {globalQuery.isLoading ? (
                        <div>
                          <SkeletonLine width={260} />
                          <SkeletonLine width={240} />
                          <SkeletonLine width={220} />
                        </div>
                      ) : globalQuery.error ? (
                        <div style={styles.errorText}>
                          Error: {globalQuery.error.message}
                        </div>
                      ) : globalQuery.data.length === 0 ? (
                        <div style={styles.emptyText}>
                          No scores yet. Be the first!
                        </div>
                      ) : (
                        <ol style={styles.list}>
                          {globalQuery.data.map((row, idx) => (
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
    </span>
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

function labelForSelection(genId, mode) {
  const genLabel = !genId || genId === 0 ? "All generations" : `Gen ${genId}`;
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
  nearbyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#444",
    marginBottom: 8,
  },
  nearbyList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: 6,
  },
  nearbyItem: {
    display: "grid",
    gridTemplateColumns: "1fr 80px",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 6,
    background: "#fafafa",
    border: "1px solid #eee",
  },
  nearbyItemCurrent: {
    background: "#e8f4fd",
    border: "2px solid #0d6efd",
    fontWeight: 600,
  },
  nearbyUser: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  nearbyName: {
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  nearbyScore: {
    textAlign: "right",
    fontWeight: 600,
    fontSize: 16,
  },
  youBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0d6efd",
    background: "#cfe1ff",
    padding: "2px 6px",
    borderRadius: 4,
  },
};

export default Leaderboard;
