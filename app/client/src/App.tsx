import { useEffect } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shell, ThemeProvider } from "@/components/atlas-ui";
import Home from "@/pages/home";
import Browse from "@/pages/browse";
import TimelinePage from "@/pages/timeline";
import { PlaylistsIndex, PlaylistDetail, SeriesDetail } from "@/pages/playlists";
import EpisodeDetail from "@/pages/episode";
import About from "@/pages/about";
import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [loc] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc]);
  return null;
}

function AppRouter() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/browse" component={Browse} />
        <Route path="/timeline" component={TimelinePage} />
        <Route path="/playlists" component={PlaylistsIndex} />
        <Route path="/playlists/:id" component={PlaylistDetail} />
        <Route path="/series/:key" component={SeriesDetail} />
        <Route path="/episode/:guid" component={EpisodeDetail} />
        <Route path="/about" component={About} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <Shell>
              <AppRouter />
            </Shell>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
