import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePoke } from "../AppContext";

function Refresher() {
  const location = useLocation();
  const { refreshRoute, refreshState } = location.state || {};

  const { preloadedPokemon } = usePoke();

  for (let [, pokeData] of Object.entries(preloadedPokemon)) {
    pokeData.staticDisplaySprite = pokeData.staticSprite;
    pokeData.displaySprite = pokeData.sprite;
  }

  const navigate = useNavigate();

  useEffect(() => {
    if (refreshRoute) {
      navigate(refreshRoute, { replace: true, state: refreshState });
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate, refreshRoute, refreshState]);
}

export default Refresher;
