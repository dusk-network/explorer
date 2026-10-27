<script>
  import "./OverviewPanelDetailsItem.css";

  export let subtitle;
</script>

<!-- A card of the web wallet's: its label, muted, above its value. -->
<div class="overview-panel__details-item">
  <p class="overview-panel__details-item-subtitle">{subtitle}</p>
  <div class="overview-panel__details-item-title"><slot /></div>
</div>
